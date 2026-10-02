#!/usr/bin/env python
"""validate-skill.py -- linter de frontmatter de skills JOCA.

Inspirado em mukul975/Anthropic-Cybersecurity-Skills tools/validate-skill.py;
implementacao limpa propria, sem dependencias externas (parse a mao do bloco
entre `---`). Windows-safe -- correr com `python` (nao `python3`, que e o stub
vazio da Microsoft Store).

USO
    # validar ficheiros especificos
    python .claude/scripts/validate-skill.py .claude/skills/caveman.md [...]

    # varrer todas as skills (sem args)
    python .claude/scripts/validate-skill.py

    # relatorio do repo inteiro (skills, agentes, referencias, commands, rules)
    python .claude/scripts/validate-skill.py --all

VALIDACOES
    (a) tem frontmatter YAML (bloco delimitado por --- no topo)
    (b) campo `name` presente e kebab-case
    (c) campo `description` presente, nao-vazio, e idealmente com triggers
    (d) `name` bate com o nome do ficheiro (sem .md)
    Regras F1.2 (so AVISAM -- o hook por-ficheiro nunca bloqueia por elas):
    (e) description com «o que + quando» (skills)
    (f) skill com >500 linhas
    (g) reference/**/*.md com >100 linhas sem indice no topo
    (h) caminhos citados existem (mesma logica do joca-doctor §9b)
    (i) Step 0 dos agentes aponta para ficheiro existente (sem excepcoes)
    (j) par confundivel: cosseno TF-IDF >=0,35 entre descriptions de skills
    So no --all: (k) cadeias skill/agente/command/rule -> ref -> ref  (l) referencias orfas
                 (m) limites da memoria por pastas (corre `lint` do lib memoria-projecto.cjs; informativo)

SAIDA
    Linha OK / WARN / FAIL por ficheiro + sumario.
    Exit 1 se algum FAIL; exit 0 caso contrario.
"""

import math
import re
import sys
from pathlib import Path

CLAUDE_DIR = Path(__file__).resolve().parent.parent
BRAIN = CLAUDE_DIR.parent
SKILLS_DIR = CLAUDE_DIR / "skills"

KEBAB_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

# Heuristica leve para detectar triggers na description.
TRIGGER_HINTS = (
    "trigger", "invoke", "invoked", "use when", "when the user",
    "must be", "activate", "activated", "usar quando", "quando",
)


def parse_frontmatter(text):
    """Extrai o bloco frontmatter delimitado por --- no topo do ficheiro.

    Devolve (dict_de_campos, erro_ou_None). Parse simples chave: valor de
    topo de nivel -- suficiente para name/description. Nao tenta YAML completo.
    """
    lines = text.splitlines()
    # Ignorar BOM/linhas em branco iniciais.
    idx = 0
    while idx < len(lines) and lines[idx].strip() == "":
        idx += 1
    if idx >= len(lines) or lines[idx].strip() != "---":
        return None, "sem frontmatter (falta `---` de abertura)"

    fields = {}
    closed = False
    i = idx + 1
    while i < len(lines):
        line = lines[i]
        if line.strip() == "---":
            closed = True
            break
        m = re.match(r"^([A-Za-z0-9_-]+)\s*:\s*(.*)$", line)
        if m:
            key = m.group(1).strip().lower()
            val = m.group(2).strip()
            # Remover aspas envolventes (simples ou duplas).
            if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
                val = val[1:-1]
            fields[key] = val
        i += 1

    if not closed:
        return None, "frontmatter nao fechado (falta `---` de fecho)"
    return fields, None



# --- Caminhos citados: porte 1:1 do joca-doctor.mjs §9b (mesmas regras e excepcoes). ---
# Se mudares uma regra aqui, muda-a la tambem (e vice-versa).
OWNED = re.compile(r"^\.claude/(skills|agents|commands|rules|reference|scripts|hooks|workflows)/|^memory/")
SUB = re.compile(r"^(rules|reference|skills|agents|commands|scripts|hooks|workflows)/")
RUNTIME = re.compile(r"^memory/(feedback|projects|knowledge|decisions|learnings|checkpoints)/")
OPCIONAL = re.compile(r"\b(exists?|existir|exista|existe|houver|opcional|optional|if present|if available|check for|verifica se)\b", re.I)
ABSENTE = re.compile(r"(n[aã]o exist|inexistente|em falta|does not exist|doesn't exist|did ?n[o']t exist|no longer exists|missing|nunca existiu)", re.I)
CREDITOS = re.compile(r"^(#{1,6}[ \t]+(?:Cr[ée]ditos|Credits|Atribui[çc][ãa]o|Attribution)\b[^\n]*\n)(.*?)(?=^#{1,6}[ \t]|\Z)", re.M | re.I | re.S)
TEMPLATE_DE_PROJECTO = re.compile(r"[\\/]reference[\\/]start[\\/]templates[\\/]")
# Cópia literal de terceiros (não se reescreve) e ficheiros gerados por script: sem índice à mão.
SEM_INDICE_DE_PROPOSITO = re.compile(r"[\\/]reference[\\/](minimax-h3-oficial[\\/]|trigger-map\.md$)")
CAND_RES = (re.compile(r"""Read\(\s*["']([^"']+)["']\s*\)"""), re.compile(r"`([^`\n]+)`"), re.compile(r"\]\(([^)\s]+)\)"))
INDICE = re.compile(r"^#{1,6}[ \t]+.*\b(conte[uú]do|[ií]ndice|sum[aá]rio|contents|table of contents|toc)\b", re.I | re.M)
STEP0 = re.compile(r"^(#{1,6})[ \t]+Step 0\b.*$", re.I | re.M)
STOP = set("""a o as os de da do das dos e em no na nos nas um uma para por com sem que se ou ao aos the and for with when use using of to in on or an is are be this that from via it its your you não nao mais como quando usar usa user""".split())


def citations(f, text):
    """Lista (caminho, linha, alvos) dos caminhos JOCA-internos citados em `text`."""
    text = CREDITOS.sub(lambda m: m.group(1) + re.sub(r"[^\n]", " ", m.group(2)), text)
    cands = {}
    for rx in CAND_RES:
        for m in rx.finditer(text):
            cands.setdefault(m.group(1), m.start())
    out = []
    d = f.parent
    comp = d / f.stem
    for raw, idx in cands.items():
        c = raw.strip()
        if re.search(r"[<>*${}|\"'\[\]\s]", c) or c.endswith("/") or not re.search(r"\.[a-z0-9]{1,5}$", c, re.I):
            continue
        if RUNTIME.search(c):
            continue
        ini = text.rfind("\n", 0, idx) + 1
        fim = text.find("\n", idx)
        linha = text[ini:fim if fim >= 0 else len(text)]
        if c.startswith("./"):
            alvos = [d / c[2:]]
        elif OWNED.search(c):
            alvos = [BRAIN / c]
        elif SUB.search(c):
            alvos = [d / c, comp / c, CLAUDE_DIR / c]
        else:
            continue
        out.append((c, linha, alvos))
    return out


def dead_pointers(f, text):
    if TEMPLATE_DE_PROJECTO.search(str(f)):
        return []
    return [c for c, linha, alvos in citations(f, text)
            if not OPCIONAL.search(linha) and not ABSENTE.search(linha) and not any(a.exists() for a in alvos)]


def step0_dead(text):
    """Caminhos no Step 0 de um agente que nao existem. Sem excepcoes OPCIONAL/ABSENTE:
    o Step 0 e obrigatorio, um «se existir» nao o torna opcional."""
    m = STEP0.search(text)
    if not m:
        return []
    nivel = len(m.group(1))
    nxt = re.compile(r"^#{1,%d}[ \t]" % nivel, re.M).search(text, m.end())
    sec = text[m.end():nxt.start() if nxt else len(text)]
    dead = []
    for rx in CAND_RES[:2]:
        for c in rx.findall(sec):
            c = c.strip()
            if (c.startswith(".claude/") or c.startswith("memory/")) and re.search(r"\.[a-z0-9]{1,5}$", c, re.I) \
                    and not re.search(r"[<>*${}|\s]", c) and not (BRAIN / c).exists() and c not in dead:
                dead.append(c)
    return dead


def kind_of(p):
    parts = [x.lower() for x in p.resolve().parts]
    if "reference" in parts:
        return "reference"
    if len(parts) >= 2 and parts[-2] == "agents":
        return "agent"
    # skill = qualquer SKILL.md ou .md com uma pasta `skills` acima (created-skills/<x>/SKILL.md,
    # skills-globais/<x>/SKILL.md): o gate de frontmatter do create-skill depende disto.
    if parts[-1] == "skill.md" or "skills" in parts[:-1]:
        return "skill"
    return "other"


# --- TF-IDF (Python puro) ---
def tokens(s):
    return re.findall(r"\w+", s.lower())


def tfidf(docs):
    """docs: {nome: texto} -> {nome: {termo: peso}}: tf sublinear, idf suavizado, L2.
    Calibrado contra a medicao do plano (VP §3.0: 52 >=0,25 / 17 >=0,35): esta variante da 54/14."""
    n = len(docs)
    toks = {k: tokens(v) for k, v in docs.items()}
    df = {}
    for ts in toks.values():
        for t in set(ts):
            df[t] = df.get(t, 0) + 1
    vecs = {}
    for k, ts in toks.items():
        v = {}
        for t in ts:
            v[t] = v.get(t, 0) + 1
        v = {t: (1 + math.log(c)) * (math.log((1 + n) / (1 + df[t])) + 1) for t, c in v.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        vecs[k] = {t: x / norm for t, x in v.items()}
    return vecs


def cos(a, b):
    if len(a) > len(b):
        a, b = b, a
    return sum(x * b.get(t, 0.0) for t, x in a.items())


PAR_LIMIAR = 0.35


def skill_catalog():
    cat = {}
    for f in sorted(SKILLS_DIR.glob("*.md")):
        try:
            fields, _ = parse_frontmatter(f.read_text(encoding="utf-8"))
        except UnicodeDecodeError:
            continue
        if fields and fields.get("description"):
            cat[f.stem] = fields["description"]
    return cat


def validate(path, catalog=None):
    """Valida um ficheiro. Devolve (status, mensagens).

    status: "OK" | "WARN" | "FAIL". FAIL so por frontmatter de skill/agente (regras antigas);
    as regras F1.2 so avisam. Cada mensagem vem prefixada pela categoria entre [].
    """
    p = Path(path)
    if not p.is_file():
        return "FAIL", ["ficheiro nao existe"]
    try:
        text = p.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return "FAIL", ["nao decodificavel como UTF-8"]

    kind = kind_of(p)
    fails, warns = [], []
    n_linhas = len(text.splitlines())

    if kind in ("skill", "agent"):
        fields, err = parse_frontmatter(text)
        if err:
            return "FAIL", [err]
        # (b) name presente e kebab-case
        name = fields.get("name")
        if not name:
            fails.append("campo `name` em falta")
        elif not KEBAB_RE.match(name):
            fails.append("`name` nao e kebab-case: %r" % name)
        # (c) description presente, nao-vazia, idealmente com triggers
        desc = fields.get("description")
        if desc is None:
            fails.append("campo `description` em falta")
        elif desc.strip() == "":
            fails.append("`description` vazia")
        elif kind == "skill":
            low = desc.lower()
            pos = [low.find(h) for h in TRIGGER_HINTS if h in low]
            if not pos:
                warns.append("[descricao] `description` sem triggers aparentes (use when/invoke/quando...)")
            elif len([t for t in tokens(desc[:min(pos)]) if len(t) > 2 and t not in STOP]) < 3:
                warns.append("[descricao] `description` sem «o que» antes do «quando»")
        # (d) name vs nome do ficheiro -- WARN, nao FAIL.
        # Convencao JOCA: o `name:` descritivo manda (ex.: horizon.md -> horizon-queues);
        # o sistema refere as skills pelo `name:`, nao pelo ficheiro (ver docs/ARQUITECTURA.md).
        if name and name != p.stem:
            warns.append("[nome] `name` (%r) != nome do ficheiro (%r) -- ok se intencional (convencao JOCA)" % (name, p.stem))
        # (j) par confundivel contra o catalogo
        if kind == "skill" and desc:
            cat = dict(catalog if catalog is not None else skill_catalog())
            cat[p.stem] = desc
            vecs = tfidf(cat)
            for k in sorted(vecs):
                if k != p.stem:
                    s = cos(vecs[p.stem], vecs[k])
                    if s >= PAR_LIMIAR:
                        warns.append("[par] description parecida com `%s` (cosseno %.2f)" % (k, s))

    if kind == "skill" and n_linhas > 500:
        warns.append("[>500] skill com %d linhas (limite 500)" % n_linhas)
    if kind == "reference" and n_linhas > 100 and not TEMPLATE_DE_PROJECTO.search(str(p)) \
            and not SEM_INDICE_DE_PROPOSITO.search(str(p)) and not INDICE.search(text[:3000]):
        warns.append("[indice] referencia com %d linhas sem indice no topo" % n_linhas)
    for c in dead_pointers(p, text):
        warns.append("[ponteiro] caminho citado nao existe: %s" % c)
    if kind == "agent":
        for c in step0_dead(text):
            warns.append("[step0] Step 0 aponta para ficheiro inexistente: %s" % c)

    if fails:
        return "FAIL", fails + warns
    if warns:
        return "WARN", warns
    return "OK", []


def rel(p):
    return Path(p).resolve().relative_to(BRAIN).as_posix()


def memoria_lint():
    """(erros, avisos) do `lintMemoria` do lib memoria-projecto.cjs, como linhas `slug: msg`.
    Sem node ou sem lib -> uma linha a dizer que nao correu (nunca rebenta o relatorio)."""
    import json
    import shutil
    import subprocess
    lib = CLAUDE_DIR / "scripts" / "lib" / "memoria-projecto.cjs"
    node = shutil.which("node")
    if not node or not lib.is_file():
        return ["(nao verificado: falta o node no PATH ou o lib .claude/scripts/lib/memoria-projecto.cjs)"], []
    try:
        r = subprocess.run([node, str(lib), "lint"], capture_output=True, text=True, encoding="utf-8", timeout=60)
        dados = json.loads(r.stdout)
    except (OSError, ValueError, subprocess.SubprocessError) as e:
        return ["(nao verificado: %s)" % e], []
    fmt = lambda xs: ["%s: %s" % (x["slug"], x["msg"]) for x in xs]
    return fmt(dados.get("erros", [])), fmt(dados.get("avisos", []))


def report_all():
    """Relatorio do repo inteiro. Devolve exit code (1 se algum FAIL de frontmatter)."""
    def md(d, rec=True):
        return sorted((d.rglob if rec else d.glob)("*.md"))
    files = (md(SKILLS_DIR, False) + md(CLAUDE_DIR / "agents") + md(CLAUDE_DIR / "reference")
             + md(CLAUDE_DIR / "commands") + md(CLAUDE_DIR / "rules"))
    catalog = skill_catalog()
    cats, fails = {}, []
    for f in files:
        status, msgs = validate(f, catalog={})  # pares calculam-se uma vez, abaixo
        for m in msgs:
            mm = re.match(r"^\[(\w+|>500)\] (.*)$", m)
            if mm:
                cats.setdefault(mm.group(1), []).append("%s: %s" % (rel(f), mm.group(2)))
            else:
                fails.append("%s: %s" % (rel(f), m))

    # (j) pares confundiveis
    vecs = tfidf(catalog)
    nomes = sorted(vecs)
    pares = []
    for i, a in enumerate(nomes):
        for b in nomes[i + 1:]:
            s = cos(vecs[a], vecs[b])
            if s >= PAR_LIMIAR:
                pares.append((s, a, b))
    pares.sort(reverse=True)
    cats["par"] = ["%.2f  %s <-> %s" % t for t in pares]

    # (k) cadeias skill -> referencia -> referencia (alvos que existem)
    def refs_citadas(f):
        try:
            text = f.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            return set()
        out = set()
        for _c, _l, alvos in citations(f, text):
            for a in alvos:
                if a.is_file() and kind_of(a) == "reference" and a.resolve() != f.resolve():
                    out.add(a.resolve())
                    break
        return out
    cache = {}
    cadeias = set()
    # Raiz = qualquer ficheiro de instrucoes que nao e referencia (skills, agentes, commands, rules):
    # so com skills a contagem de hoje e 0 -- as cadeias reais partem das rules e commands.
    for s in files:
        if kind_of(s) == "reference":
            continue
        for a in refs_citadas(s):
            if a not in cache:
                cache[a] = refs_citadas(a)
            for b in cache[a]:
                cadeias.add((rel(s), rel(a), rel(b)))
    ligacoes = sorted({(a, b) for _s, a, b in cadeias})
    cats["cadeia"] = ["%s -> %s  (via %s)" % (a, b, ", ".join(sorted({s.split("/")[-1] for s, x, y in cadeias if (x, y) == (a, b)})))
                      for a, b in ligacoes]

    # (l) referencias orfas: ninguem em .claude/ (nem os CLAUDE.md/INDEX) cita o caminho
    corpus = []
    for f in CLAUDE_DIR.rglob("*"):
        if f.is_file() and f.suffix in (".md", ".js", ".mjs", ".py", ".sh", ".json"):
            try:
                corpus.append((f.resolve(), f.read_text(encoding="utf-8")))
            except (OSError, UnicodeDecodeError):
                pass
    for f in (BRAIN / "CLAUDE.md", BRAIN / "memory" / "INDEX.md", BRAIN.parent / "CLAUDE.md"):
        if f.is_file():
            corpus.append((f.resolve(), f.read_text(encoding="utf-8", errors="replace")))
    orfas = []
    for r in md(CLAUDE_DIR / "reference"):
        if TEMPLATE_DE_PROJECTO.search(str(r)):
            continue
        chave = "reference/" + r.relative_to(CLAUDE_DIR / "reference").as_posix()
        # citar a pasta (`reference/gsap/`) conta como citar o que esta dentro
        chaves = [chave] + [chave[:i + 1] for i, ch in enumerate(chave) if ch == "/" and i > len("reference")]
        rr = r.resolve()
        if not any(any(k in t for k in chaves) or (fp.parent == rr.parent and r.name in t)
                   for fp, t in corpus if fp != rr):
            orfas.append(rel(r))
    cats["orfa"] = orfas

    # (m) memoria por pastas (issue #82): as regras vivem no lib JS (fonte unica, o doctor §7 usa a mesma);
    # aqui so se mostra a lista. Informativo: nao mexe no exit code.
    mem_erros, mem_avisos = memoria_lint()
    cats["memoria"] = mem_erros
    cats["memoria-aviso"] = mem_avisos

    titulos = [
        (">500", "Skills com >500 linhas"),
        ("indice", "Referencias >100 linhas sem indice"),
        ("cadeia", "Cadeias instrucao -> ref -> ref (ligacoes ref->ref distintas; %d cadeias)" % len(cadeias)),
        ("par", "Pares confundiveis (cosseno TF-IDF >= %.2f, %d skills)" % (PAR_LIMIAR, len(catalog))),
        ("ponteiro", "Caminhos citados inexistentes"),
        ("step0", "Step 0 de agentes a apontar para ficheiro inexistente"),
        ("orfa", "Referencias orfas (ninguem as cita)"),
        ("descricao", "Descriptions sem «o que + quando»"),
        ("nome", "`name` != nome do ficheiro (informativo)"),
        ("memoria", "Memoria por pastas fora do limite (index <=40 linhas nao vazias e <=4000 B de corpo, <=3 linhas por area, ficheiros listados, sem fichas planas)"),
        ("memoria-aviso", "Memoria por pastas: avisos (area >40 KB, >8 areas)"),
    ]
    print("validate-skill --all  (%d ficheiros: skills, agents, reference, commands, rules)" % len(files))
    for k, t in titulos:
        itens = cats.get(k, [])
        print("\n## %s: %d" % (t, len(itens)))
        for i in itens:
            print("  - " + i)
    print("\n## FAIL (frontmatter): %d" % len(fails))
    for i in fails:
        print("  - " + i)
    return 1 if fails else 0


def main(argv):
    args = argv[1:]
    if args == ["--all"]:
        return report_all()
    if args:
        targets = [Path(a) for a in args]
    else:
        if not SKILLS_DIR.is_dir():
            print("FAIL: diretorio de skills nao encontrado: %s" % SKILLS_DIR)
            return 1
        targets = sorted(SKILLS_DIR.glob("*.md"))
        if not targets:
            print("WARN: nenhum .md em %s" % SKILLS_DIR)
            return 0

    catalog = skill_catalog() if len(targets) > 1 else None
    counts = {"OK": 0, "WARN": 0, "FAIL": 0}
    for t in targets:
        status, msgs = validate(t, catalog)
        counts[status] += 1
        line = "[%-4s] %s" % (status, t.name)
        print(line)
        for m in msgs:
            print("        - %s" % m)

    print("")
    print("Total: %d  OK: %d  WARN: %d  FAIL: %d" % (
        len(targets), counts["OK"], counts["WARN"], counts["FAIL"]))

    return 1 if counts["FAIL"] else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main(sys.argv))

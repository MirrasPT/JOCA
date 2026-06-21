---
name: filament-v5-gotchas
description: Armadilhas do Filament v5 que dão fatal/500 silencioso — tipos de navigationGroup e getIcon de enums
metadata:
  type: feedback
---

Dois erros do Filament v5 que partem o boot do painel ou o render, apanhados no projeto [[bigorna-2026]]:

**1. `$navigationGroup` (e props de navegação) em Pages/Resources v5 exigem tipo `string|UnitEnum|null`.**
Declarar `protected static ?string $navigationGroup` → *Fatal: Type must be UnitEnum|string|null (as in parent)* no discoverPages → painel inteiro 500. Usar `protected static string|\UnitEnum|null $navigationGroup = '...';`.

**2. Enum `getIcon()` (contrato `HasIcon`) deve devolver o Heroicon enum CASE, não `->value`.**
`return Heroicon::OutlinedBanknotes;` ✓ — `return Heroicon::OutlinedBanknotes->value;` ✗ → render do badge falha com *"Svg by name 'o-banknotes' from set 'default' not found"* (perde o set do ícone). Return type: `string|\BackedEnum|null`.

**Why:** A skill `filament` documenta os namespaces v5 (Schemas\Components, recordActions) mas não estes dois tipos — ambos dão erro só em runtime, não no `php -l`.

**How to apply:** Ao escrever enums Filament, devolver o enum case nos 3 contratos. Ao definir navegação em Pages/Resources, usar `string|\UnitEnum|null`. Verificar sempre com `php artisan route:list` (força boot do painel) ou um teste `Livewire::test(Page::class)->assertOk()` após `Filament::setCurrentPanel(...)` — apanha o que o lint não apanha.

---
name: platform
description: DevOps engineering — CI/CD pipelines, Docker/Kubernetes, infrastructure as code, cloud provisioning, deployment strategies, incident response, and platform tooling. Triggers: DevOps, CI/CD, pipeline, Docker, Dockerfile, Kubernetes, K8s, Terraform, GitHub Actions, GitLab CI, deployment, infrastructure, IaC, Helm, Pulumi, blue-green, canary, rollback, on-call, incident, platform engineering.
---

ENFORCE: IaC for all infra (no manual changes) · `terraform plan` before apply · lint CI configs before commit · smoke tests post-deploy · rollback procedure documented before go-live · multi-stage Docker builds · non-root container users · secrets in vault/env manager never in image/code · resource limits on all K8s containers · health + readiness probes · container scanning in CI

DEPLOYMENT: blue-green (zero downtime) · canary (% rollout + metrics gate) · rolling (default) · GitOps (ArgoCD/Flux) for K8s

NEVER: hardcode secrets in Dockerfiles/CI vars · `latest` tag in production · skip health checks · deploy without rollback plan · cluster-admin unless required · `terraform apply` without plan review · Friday deploys without monitoring

REF (load on demand):
- GitHub Actions → `references/github-actions.md`
- Docker → `references/docker-patterns.md`
- Kubernetes → `references/kubernetes.md`
- Terraform/IaC → `references/terraform-iac.md`
- Deployment strategies → `references/deployment-strategies.md`
- Platform engineering → `references/platform-engineering.md`
- Release automation → `references/release-automation.md`
- Incident response → `references/incident-response.md`

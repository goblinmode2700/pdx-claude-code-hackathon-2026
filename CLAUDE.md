# CLAUDE.md — PDX Fleet Optimizer (Hackathon)

## Inherited from greenline

### Code Standards (keep)
- All inputs/outputs use Pydantic models — no raw dicts across boundaries
- Services contain business logic, routers are thin
- No `any` in TypeScript — use proper interfaces in `types/`
- Error handling: services raise, routers catch and map to HTTP

### Git (simplified)
- Branch: main (it's a hackathon)
- Commit after each working milestone
- Prefixes: feat, fix only

### Skip for hackathon
-
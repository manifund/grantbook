# Grantbook

Database of AI safety grants. See `CLAUDE.md` for architecture and commands.

## Setup

```bash
bun install
cp .env.example .env.local   # fill in Supabase keys
# apply supabase/migrations/ to the project, then:
bun run seed
bun run ingest
bun run dev
```

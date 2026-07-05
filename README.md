# BMS

Project local cho BMS GMP web.

Path:

```text
/Users/iphone9/Projects/BMS
```

GitHub:

```text
https://github.com/tienhoandhd-droid/bms-gmp-web
```

## Status

- Git repo da ket noi voi `origin/main`.
- Ung dung frontend nam trong `web/`.
- Supabase client da co san trong `web/src/lib/bmsClient.js`.
- Supabase CLI config local nam trong `supabase/config.toml`.
- n8n MCP endpoint dung chung cau hinh Codex: `https://n8n.cpc1hn.com/mcp-server/http`.

## Luat n8n cho BMS

Codex chi duoc tac dong vao workflow n8n co ten bat dau bang `BMS`.

Quy tac bat buoc:

- Truoc moi thao tac n8n, phai xac minh ten workflow chinh xac.
- Chi workflow co prefix `BMS` moi duoc doc sau, sua, execute, publish,
  unpublish, archive, duplicate, rename, hoac delete.
- Workflow khong bat dau bang `BMS` chi duoc phep hien ten khi can loc danh sach;
  khong doc noi dung va khong tac dong.
- Moi thao tac ghi/control tren workflow BMS van can nguoi dung xac nhan truoc.
- Khong sua credential n8n neu nguoi dung chua yeu cau ro va chua co plan an toan.

## Ket noi Supabase rieng

Frontend chi can Supabase URL va anon public key. Khong dua service-role key vao
frontend hoac source code.

1. Tao file env local tu mau:

```bash
cp web/.env.example web/.env.local
```

2. Dien thong tin Supabase rieng cua ban:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

3. Chay frontend:

```bash
cd web
npm install
npm run dev
```

4. Neu muon lien ket Supabase CLI voi project cloud rieng:

```bash
SUPABASE_TELEMETRY_DISABLED=1 supabase link --project-ref <project-ref>
```

Lenh `supabase link` chi thiet lap lien ket local/CLI. Cac lenh ghi schema/du lieu
nhu `supabase db push`, migration apply, hoac SQL write can duoc xac nhan rieng
truoc khi chay.

## Quyen API cho web BMS

Migration local da duoc tao tai:

```text
supabase/migrations/20260702134151_bms_authenticated_api_grants.sql
```

Migration nay cap quyen cho role `authenticated` doc cac view va goi cac RPC ma
frontend BMS dang dung. Khong grant du lieu nghiep vu cho role `anon`.

Rollback thu cong nam tai:

```text
supabase/rollbacks/20260702134151_bms_authenticated_api_grants_down.sql
```

De apply len Supabase cloud rieng, may can dang nhap Supabase CLI:

```bash
supabase login
SUPABASE_TELEMETRY_DISABLED=1 supabase link --project-ref jfonqwhjhsylruwfllbk
SUPABASE_TELEMETRY_DISABLED=1 supabase db push --linked
```

Chi chay `supabase db push --linked` sau khi da xac nhan day la project dung va
duoc phep ghi schema/quyen.

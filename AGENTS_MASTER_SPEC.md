# 🏛️ MASTER SPECIFICATION: SYNUSIA / ARTLLABS CORE ENGINE

## 1. System Vision & Context
Synusia is a Challenge-Based Learning (CBL) simulation platform designed to counteract "cognitive offloading" and foster Critical AI Literacy. Unlike standard conversational agents that provide immediate answers, Synusia implements **Calibrated Cognitive Friction** via **Pedagogical Resistances** and **Interaction Hurdles**.

- **Baseline Maturity:** TRL 3/4 (Functional Prototype with Realtime Telemetry and Monetization).
- **Target Evolution:** TRL 6/7 (Domain-Agnostic, Template-Driven Framework for ARTLLABS Horizon Europe).
- **Primary Goal for Agents:** Build a robust, type-safe, modular Next.js + Supabase implementation where narrative content is decoupled from core interaction logic, monetization is strictly enforced, and student terminals react in real-time to administrative state changes.

---

## 2. Tech Stack & Non-Negotiable Rules
- **Framework:** Next.js (App Router, TypeScript strict mode).
- **Database & Realtime:** Supabase (PostgreSQL, Realtime JS SDK `@supabase/supabase-js`).
- **Styling:** Tailwind CSS (Dark-mode futuristic UI/Slate palette).
- **Strict Naming Convention:** PostgreSQL tables and columns MUST use `snake_case`. TypeScript interfaces MUST match PostgreSQL column names exactly.
- **State Management:** Local React state (`useState`, `useRef`) paired with Supabase Realtime Channels. Do NOT introduce external global state managers (Redux, Zustand) unless requested.

---

## 3. Database Schema (Single Source of Truth - DDL)

Agents must adhere strictly to the following PostgreSQL relational schema:

```sql
-- 1. Clients Table (Monetization Core)
CREATE TABLE public.clients (
  id_client UUID NOT NULL DEFAULT gen_random_uuid(),
  nom VARCHAR(255) NOT NULL,
  tipus_client VARCHAR(50) NOT NULL CHECK (tipus_client IN ('ACADEMIC', 'CORPORATE')),
  sector VARCHAR(100) NOT NULL,
  credits_disponibles INT NOT NULL DEFAULT 0 CHECK (credits_disponibles >= 0),
  creat_el TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT clients_pkey PRIMARY KEY (id_client)
);

-- 2. Pedagogical Templates Table (Decoupled Scenario Logic)
CREATE TABLE public.pedagogical_templates (
  id_template VARCHAR(100) NOT NULL,
  titol VARCHAR(255) NOT NULL,
  scenario_context JSONB NOT NULL,    -- Domain challenge narrative & datasets
  interaction_protocols JSONB NOT NULL, -- Triggers & Interaction Hurdles logic gates
  assessment_metrics JSONB NOT NULL,    -- Mapping telemetry to critical soft skills
  CONSTRAINT pedagogical_templates_pkey PRIMARY KEY (id_template)
);

-- 3. Sessions Table (Live Classroom Execution)
CREATE TABLE public.sessions (
  id_sessio UUID NOT NULL DEFAULT gen_random_uuid(),
  pin_acces VARCHAR(10) NOT NULL UNIQUE,
  estat VARCHAR(20) NOT NULL DEFAULT 'EN_CURS' CHECK (estat IN ('EN_CURS', 'FINALITZADA')),
  id_client UUID NOT NULL,
  id_template VARCHAR(100) NOT NULL DEFAULT 'MISION_1',
  id_facilitador UUID NULL,
  creat_el TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT sessions_pkey PRIMARY KEY (id_sessio),
  CONSTRAINT sessions_id_client_fkey FOREIGN KEY (id_client) REFERENCES public.clients(id_client) ON DELETE CASCADE,
  CONSTRAINT sessions_id_template_fkey FOREIGN KEY (id_template) REFERENCES public.pedagogical_templates(id_template)
);

-- 4. Teams Table (Student Groups)
CREATE TABLE public.equips (
  id_equip UUID NOT NULL DEFAULT gen_random_uuid(),
  id_sessio UUID NOT NULL,
  nom_equip VARCHAR(100) NOT NULL,
  missio_actual VARCHAR(100) NOT NULL DEFAULT 'MISION_1',
  integrants JSONB NULL,
  dossier_actiu JSONB NULL,
  creat_el TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT equips_pkey PRIMARY KEY (id_equip),
  CONSTRAINT equips_id_sessio_fkey FOREIGN KEY (id_sessio) REFERENCES public.sessions(id_sessio) ON DELETE CASCADE
);

-- 5. Telemetry Logs Table (Behavioral Analytics Engine)
CREATE TABLE public.telemetry_logs (
  id_log UUID NOT NULL DEFAULT gen_random_uuid(),
  id_sessio UUID NOT NULL,
  id_equip UUID NOT NULL,
  tipo_evento VARCHAR(50) NOT NULL CHECK (tipo_evento IN ('PROMPT_SUBMISSION', 'HURDLE_TRIGGERED', 'MILESTONE_COMPLETED')),
  metrics_payload JSONB NOT NULL, -- Contains reflection intervals, iteration cycles, etc.
  creat_el TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT telemetry_logs_pkey PRIMARY KEY (id_log),
  CONSTRAINT telemetry_id_sessio_fkey FOREIGN KEY (id_sessio) REFERENCES public.sessions(id_sessio) ON DELETE CASCADE,
  CONSTRAINT telemetry_id_equip_fkey FOREIGN KEY (id_equip) REFERENCES public.equips(id_equip) ON DELETE CASCADE
);

-- Disable RLS for Development Mode
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.equips DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedagogical_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_logs DISABLE ROW LEVEL SECURITY;
```

---

## 4. Architecture & Core Modules (`/lib`)
- **`lib/types.ts`**: Strict TypeScript interfaces matching PostgreSQL schema DDL column names in `snake_case`.
- **`lib/supabase.ts`**: Supabase client initialization.
- **Narrative Decoupling**: Hardcoded narratives are moved into `pedagogical_templates` table in Supabase.

---

## 5. API & Realtime Synchronization Protocol
- **`POST /api/join-session`**: Validates PIN against `sessions` table (`estat = 'EN_CURS'`), initializes `equips` entry.
- **`POST /api/chat`**: Evaluates prompts against `pedagogical_templates` interaction protocols, deducts credits from `clients`, records behavioral telemetry to `telemetry_logs`.
- **Realtime Channels**: Student view (`app/page.tsx`) listens on `sessions` (`pin_acces`) for state changes (`FINALITZADA`) and locks interface when closed. Admin view (`app/admin/page.tsx`) receives team updates.

---

## 6. Execution Order (Ordre d'Execució Pas per Pas)
- **Step 1: Type Definitions & Core Infrastructure (`/lib`)**
  - Create `/lib/types.ts` strictly matching DDL schema (`Client`, `PedagogicalTemplate`, `Sessio`, `Equip`, `TelemetryLog`).
  - Verify `/lib/supabase.ts` initialization and exports.
- **Step 2: Backend API Routes (`/app/api`)**
  - Refactor `/app/api/join-session/route.ts` to validate sessions and return session/template context.
  - Refactor `/app/api/chat/route.ts` to integrate template logic, credit deduction, telemetry logging, and AI completion.
- **Step 3: Refactor Student Terminal (`app/page.tsx`)**
  - Maintain exact UI design and Tailwind CSS layout.
  - Adapt state and data fetching to use `/lib/types.ts`.
  - Implement Supabase Realtime channel listener for session closure (`FINALITZADA`).
  - Fetch mission narratives dynamically from `pedagogical_templates`.
- **Step 4: Refactor Facilitator Admin Panel (`app/admin/page.tsx`)**
  - Maintain exact UI design and Tailwind CSS layout.
  - Align queries and mutations with new DDL schema.
  - Ensure session launch, credit management, and session archiving work seamlessly.
- **Step 5: Verification & Build**
  - Validate TypeScript compilation (`npm run build`).
  - Check off all DoD items in Section 7.

---

## 7. Definition of Done Checklist (Llista de Comprovació)
- [ ] **1. Type Safety**: All TypeScript models in `lib/types.ts` match the PostgreSQL `snake_case` schema DDL.
- [ ] **2. Narrative Decoupling**: Narrative content is fetched from `pedagogical_templates` table in Supabase.
- [ ] **3. Credit Management**: Monetization logic is strictly enforced on `clients.credits_disponibles`.
- [ ] **4. Realtime Lock**: Student interface instantly locks upon session status changing to `FINALITZADA`.
- [ ] **5. Behavioral Telemetry**: Interactions generate structured records in `telemetry_logs`.
- [ ] **6. UI Preserved**: Visual appearance, Tailwind CSS styling, and UX of `app/page.tsx` and `app/admin/page.tsx` are fully preserved.
- [ ] **7. Zero Build Errors**: `npm run build` succeeds cleanly without type errors.

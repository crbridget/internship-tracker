-- Current schema, after migrations 001–006. Reference only: change the
-- database through a new file in migrations/, then mirror it here.

CREATE TABLE public.companies (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  company_name character varying NOT NULL UNIQUE,
  source_token character varying NOT NULL UNIQUE,
  source character varying NOT NULL,
  status character varying NOT NULL DEFAULT 'active'::character varying,
  verified_date timestamp without time zone NOT NULL,
  last_checked timestamp without time zone,
  consecutive_failures integer NOT NULL DEFAULT 0,
  CONSTRAINT companies_pkey PRIMARY KEY (id)
);
CREATE TABLE public.job_postings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  company_id bigint NOT NULL,
  external_job_id character varying NOT NULL,
  title character varying NOT NULL,
  location character varying,
  description text,
  description_hash character varying,
  apply_url character varying NOT NULL,
  first_published timestamp without time zone,
  source_updated_at timestamp without time zone,
  first_seen_at timestamp without time zone NOT NULL,
  last_seen_at timestamp without time zone NOT NULL,
  status character varying NOT NULL,
  CONSTRAINT job_postings_pkey PRIMARY KEY (id),
  CONSTRAINT job_postings_company_external_unique UNIQUE (company_id, external_job_id),
  CONSTRAINT job_posting_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE TABLE public.users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  auth_user_id uuid UNIQUE,      -- unused; meant for Supabase Auth
  clerk_user_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_companies (
  user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id bigint NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, company_id)
);
CREATE TABLE public.user_targets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
CREATE TABLE public.notifications_sent (
  user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  posting_id bigint NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, posting_id)
);
CREATE TABLE public.applications (
  user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  posting_id bigint NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  status text NOT NULL
    CHECK (status IN ('saved', 'applied', 'interviewing', 'offer', 'rejected')),
  notes text,
  applied_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, posting_id)
);

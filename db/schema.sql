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
  external_job_id character varying NOT NULL UNIQUE,
  title character varying NOT NULL,
  location character varying,
  description text,
  apply_url character varying NOT NULL,
  first_published timestamp without time zone,
  source_updated_at timestamp without time zone,
  first_seen_at timestamp without time zone NOT NULL,
  last_seen_at timestamp without time zone NOT NULL,
  status character varying NOT NULL,
  relevance_score double precision,
  user_label character varying,
  CONSTRAINT job_postings_pkey PRIMARY KEY (id),
  CONSTRAINT job_posting_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
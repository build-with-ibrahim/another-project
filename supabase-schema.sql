-- Users table
create table if not exists users (
  id bigserial primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Schedules table
-- days_schedule is a JSONB array: [{"day":"Monday","start_time":"09:00","hours":8}, ...]
create table if not exists schedules (
  id bigserial primary key,
  user_id bigint not null references users(id),
  week_start date not null,
  days_schedule jsonb not null,
  locked_until timestamptz not null,
  created_at timestamptz not null default now(),
  unique(user_id, week_start)
);

-- Attendance table
create table if not exists attendance (
  id bigserial primary key,
  user_id bigint not null references users(id),
  date date not null,
  check_in timestamptz not null,
  check_out timestamptz,
  scheduled_start text,
  is_matched boolean,
  created_at timestamptz not null default now(),
  unique(user_id, date)
);

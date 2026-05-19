-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- CARS table
create table cars (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  model text not null,
  rego text not null,
  purchase_price numeric not null default 0,
  purchase_date date,
  photo text,
  status text not null default 'instock',  -- 'instock' or 'sold'
  sell_price numeric,
  sold_date date
);

-- EXPENSES table (each expense belongs to one car)
create table expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  car_id uuid not null references cars(id) on delete cascade,
  date date not null,
  type text not null,
  description text,
  amount numeric not null default 0,
  paid_by text not null,  -- 'Justin' or 'Angela'
  receipt text
);

-- Allow public read/write (no login required — both Justin and Angela can use it)
alter table cars enable row level security;
alter table expenses enable row level security;

create policy "Public access cars" on cars for all using (true) with check (true);
create policy "Public access expenses" on expenses for all using (true) with check (true);

alter table invoices add column if not exists stay_id uuid references stays(id);
alter table restaurant_orders add column if not exists stay_id uuid references stays(id);
alter table stays add column if not exists payment_status text default 'pending' check (payment_status in ('pending','partial','paid'));
alter table stays add column if not exists invoice_id uuid references invoices(id);
alter table payments add column if not exists recorded_by_name text;
alter table main_courante add column if not exists stay_id uuid references stays(id);

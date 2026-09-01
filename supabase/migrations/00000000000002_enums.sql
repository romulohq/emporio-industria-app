create type order_status as enum ('pending', 'in_progress', 'completed', 'cancelled');
create type order_priority as enum ('low', 'medium', 'high');
create type movement_type as enum ('entry', 'exit', 'adjustment');

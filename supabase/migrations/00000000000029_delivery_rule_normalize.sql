-- Delivery timing is now a single rule in lib/delivery-schedule.ts (production
-- = D-1, or Saturday for a Monday delivery since there is no Sunday
-- production; stock report due 23:59 the day before production). Per-store
-- custom send weekday / deadline time are no longer read anywhere.
--
-- This resets the stored values to what the rule produces so any older
-- deployed code keeps showing the right thing, and makes send_weekday
-- optional so new code doesn't have to write it. The three columns are dead
-- now and can be dropped in a follow-up once this version is deployed.

update store_delivery_days
set send_weekday = (case weekday
      when 'monday' then 'friday'
      when 'tuesday' then 'sunday'
      when 'wednesday' then 'monday'
      when 'thursday' then 'tuesday'
      when 'friday' then 'wednesday'
      when 'saturday' then 'thursday'
      when 'sunday' then 'friday'
    end)::weekday,
    deadline_time = '23:59',
    is_custom = false;

alter table store_delivery_days alter column send_weekday drop not null;

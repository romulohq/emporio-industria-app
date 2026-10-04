-- Unit abbreviation for single units is "und" instead of "un".
update products set unit = 'und' where unit = 'un';
alter table products alter column unit set default 'und';

-- Horex · 0006 (pedido del usuario, 20 oct 2026): hay personas que trabajan hasta 24 horas seguidas.
-- El límite por registro pasa de 16 a 24 horas.

alter table registros_horas
  drop constraint registros_horas_horas_check,
  add constraint registros_horas_horas_check check (horas >= 0 and horas <= 24);

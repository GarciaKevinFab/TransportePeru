-- ============================================================================
-- 020 - El color por defecto pasa a ser el de la marca
-- ============================================================================
-- El sistema es de marca blanca: cada empresa puede fijar su brand_color y la
-- interfaz se pinta con el suyo. Eso se queda como esta.
--
-- Lo que cambia es el DEFECTO. Era #f97316 (naranja), heredado de cuando el
-- producto no tenia identidad propia. Ahora la marca es CargoXprez y su rojo
-- es #e00000, sacado del logotipo. Con el defecto viejo, cada empresa nueva
-- nacia con un color que no es el de ninguna marca -ni la nuestra ni la suya-.
--
-- SOLO SE TOCAN LAS FILAS QUE SIGUEN CON EL DEFECTO VIEJO EXACTO. Quien haya
-- elegido un color a proposito -que para eso esta la pantalla de
-- Configuracion- se queda con el suyo: cambiarselo seria pisarle una decision.
alter table companies alter column brand_color set default '#e00000';

update companies
   set brand_color = '#e00000'
 where brand_color = '#f97316';

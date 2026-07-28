-- ============================================================
-- Seed: aliados/predios de jurídica desde 'Aliados territoriales.xlsx'
-- Generado 2026-07-28. Ejecutar UNA vez en Supabase SQL Editor.
-- HOJA 1 para todos; HOJA 3 (análisis legal) donde el Excel lo tenía.
-- Idempotente por matrícula / documento (NOT EXISTS). No toca esquema.
-- Propietario/municipio vacío -> marcador; documento S/D-* (sin cédula en el Excel).
-- ============================================================
BEGIN;

-- ---------- ALIADOS NUEVOS ----------
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-SINPROP','Por completar','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-SINPROP');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-D5CD183E','Abraham Bejarano','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-D5CD183E');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-59D94712','Adain Cubillos Carvajal','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-59D94712');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-8022CA8C','Alirio Salamanca Perdomo','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-8022CA8C');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-B5554166','Amalia Nuñez Motta y Tomas Nuñez Motta','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-B5554166');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-B61F9F77','Antonio Maria Calderon Gomez','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-B61F9F77');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-D932B36D','Antonio Ricardo Perdomo','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-D932B36D');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-EF4E62FB','Arnulfo Barahona Torres','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-EF4E62FB');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-00DC12F2','Azucena Blanco Torres','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-00DC12F2');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-3FA00814','Benjamin Rodriguez Díaz','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-3FA00814');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-8CD45135','Benjamín Vargas Castro','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-8CD45135');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-B2F8E712','Bruno Mosquera Plazas','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-B2F8E712');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-7859E0F7','Camilo Alexis Osa Artunduaga','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-7859E0F7');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-0074F433','Carlos Andres Jaramillo Suarez','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-0074F433');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-211608F5','Carlos Jamir Osorio Mosquera','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-211608F5');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-38131547','Cristobal Tapiero','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-38131547');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-42EFE93B','Cruz Mireya Casanova','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-42EFE93B');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-380A5A9B','Deyanira Rivera Salgado','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-380A5A9B');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-7500C139','Diego Ramirez Osorio','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-7500C139');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-C555D655','Doris Vega Salinas','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-C555D655');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-DB2E3341','Edgar Cabrera Silva','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-DB2E3341');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-E2F0C6B5','Escuela bosque-Florencia','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-E2F0C6B5');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-B6410A9A','Escuela bosque-Morelia','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-B6410A9A');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-C6B8624C','Esteban Losada Ramos','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-C6B8624C');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-6F0B1E68','Fabio Silva Yosa','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-6F0B1E68');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-B537CAB7','Faiber Andrés Salazar Pena','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-B537CAB7');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-5275C440','Fundación Inti Wasi','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-5275C440');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-839C2797','Gabriel Gasca Yate','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-839C2797');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-53BC2115','German Jaramillo','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-53BC2115');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-E3BC99F8','Gustavo Adolfo Hermida Echeverry','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-E3BC99F8');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-B13FFBD0','Gustavo Meneses Triana','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-B13FFBD0');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-96D0A263','Hernando Cuellar Cardenas','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-96D0A263');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-231581B6','Ivan Marino Ortíz Pulido','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-231581B6');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-8F41215A','Jaime Lozano Tapiero','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-8F41215A');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-12EC32EA','Jairo Loaiza Leon','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-12EC32EA');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-AD6CDFC8','Jaro Lozada Cuellar','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-AD6CDFC8');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-E3F111B5','Javier Avila Martinez','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-E3F111B5');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-FD1C14DF','Jesus Emilio Beltrán Ballesteros','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-FD1C14DF');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-A084F9BC','Jesús Ome Rentería','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-A084F9BC');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-ECE3ADCF','Jhon Edinson Anacona Murcia','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-ECE3ADCF');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-9E30937A','Johan Carrillo','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-9E30937A');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-FF22A4A2','Jose Erminso Prada Carrillo','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-FF22A4A2');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-672EB15D','Jose Francés Caicedo Montaño y Nubia Murcia Gongora','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-672EB15D');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-25BE43FC','Jose Lizardo Medina Benitez','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-25BE43FC');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-2B0248DD','Jose Miller Rojas Vargas','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-2B0248DD');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-A15526B6','José Jesus Rendon Orozco','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-A15526B6');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-A8E2D617','José Ricardo Gutiérrez Rojas y Alicia Suárez Escobar','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-A8E2D617');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-DC902D98','Juan Carlos Ortiz Pulido','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-DC902D98');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-B8FD5DB8','Juan Sebastian Claros Gutierrez','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-B8FD5DB8');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-A317A67E','Juan de Jesús Silva Silva','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-A317A67E');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-160FAA69','Kerly Suleny Jaramillo Calderon','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-160FAA69');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-05BE813B','Leonardo Jimenez Ome','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-05BE813B');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-B8498BD6','Liliana Murcia Rivera y Sara Isabela Castillo','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-B8498BD6');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-C823C28C','Luis Alejandro Pena Yojar','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-C823C28C');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-30CDE5D3','Luis Alfonso Lopez Archila','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-30CDE5D3');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-FCE4902D','Luis Alfonso Meneses Triana','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-FCE4902D');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-5D572210','Luis Felipe Florez','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-5D572210');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-80DBD7A7','Luis Fernando Suarez Barragan','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-80DBD7A7');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-874D07DC','Luz Adriana Ramírez Sepulveda','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-874D07DC');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-21ADBDC5','Luz Marina Macias Acosta','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-21ADBDC5');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-CA6A749B','Luz Mireya Quina Cruz','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-CA6A749B');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-178A2E9B','Luz Nancy Quintero Ramirez - Esteban Losada Ramos','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-178A2E9B');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-A4FC503C','MARELLY RUIZ RENGIFO','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-A4FC503C');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-4B0AF9B5','Margarita Paladinez de Fajardo','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-4B0AF9B5');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-1B99C1B3','Maria Alejandra Cadena Cogollo','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-1B99C1B3');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-38D60CE6','Maria Bellanit Gamboa Rodriguez','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-38D60CE6');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-C846B1AC','Maria Cristina Umaña Monje','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-C846B1AC');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-A836CFD5','Maria Eugenia Franco','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-A836CFD5');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-69105DE0','Marta Cecilia Guzman','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-69105DE0');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-F215CE70','María Oneida Avilés','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-F215CE70');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-46039A18','Matilde Carvajal Calderón','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-46039A18');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-FDD446E9','Mesias Mavesoy Arregui','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-FDD446E9');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-65BB5334','Miguel Arcangel Diaz Moreno','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-65BB5334');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-D069624E','Neila Lozada Ospina','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-D069624E');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-CA6A07BF','Nelly Jaramillo Rojas','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-CA6A07BF');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-39F9CDB7','Noel Plazas Artunduaga','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-39F9CDB7');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-1C5F18E3','Pablo Rojas Sánchez','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-1C5F18E3');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-38B4010B','Rafael Fajardo Ibañez','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-38B4010B');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-2628B7DA','Ricardo Gomez Perdomo','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-2628B7DA');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-3456F327','Richardine Losada Cuellar','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-3456F327');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-AD3CF778','Rodolfo Benavides Ortíz','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-AD3CF778');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-716F8F6C','The Amazon´s International Trade Zone S.A.S.','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-716F8F6C');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-1A17C931','Valentin Cuellar Rojas','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-1A17C931');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-83354EFC','Álvaro Marlés Artunduaga','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-83354EFC');
INSERT INTO core.aliados (tipo_persona,tipo_documento,numero_documento,nombre_completo,created_by)
SELECT 'natural','CC','S/D-E1D84E27','Álvaro Marlés Artunduaga 2','legal@amazoniaemprende.com'
WHERE NOT EXISTS (SELECT 1 FROM core.aliados WHERE numero_documento='S/D-E1D84E27');

-- ---------- PREDIOS + EXPEDIENTE + DEBIDA DILIGENCIA (+ ANÁLISIS) ----------
-- #1 Abraham Bejarano · El Prado · 420-137521
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'El Prado','Caquetá','Morelia','Rochela alta',NULL,'420-137521',ARRAY['420-137521']::text[],'184790003000000140017000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-D5CD183E'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-137521');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-137521'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-137521'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-137521'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);
INSERT INTO juridica.analisis_juridico (predio_id,created_by,estado_folio,vereda_registral,fmi_matrices,fmi_derivados,acto_origen,descripcion_acto_origen,naturaleza_juridica,falsa_tradicion,procesos_judiciales,procesos_judiciales_desc,medidas_cautelares,medidas_cautelares_desc,concepto_ant,concepto_urt,concepto_pnn,observaciones)
SELECT p.id,'legal@amazoniaemprende.com','ACTIVO','Rochela Alta','420-37324 y 420-110232',NULL,'ADJUDICACIÓN DE BALDÍOS','RESOLUCIÓN NO. 01730 DEL 13/08/1971 del INCORA FLORENCIA','Privado',false,false,NULL,false,NULL,NULL,NULL,NULL,'Área registral (Excel): Se debe validar con los linderos del FMI, dado que no está clara. El folio de mayor extensión tenía 25 hectáreas y se dividió en 3 predios. | El FMI que remite el propietario correspondía al predio de mayor extensión, el cual ya se encontraba cerrado. De esa forma, se evidenció que el predio se subdividió en 3 predios, dos de los cuales fueron enajenados a terceros y uno de ellos se mantuvo a nombre del señor Abraham. Por ello, se realiza el análisis sobre el folio del que aún es dueño.'
FROM core.predios p WHERE p.matricula_inmobiliaria='420-137521'
  AND NOT EXISTS (SELECT 1 FROM juridica.analisis_juridico aj WHERE aj.predio_id=p.id);

-- #2 Adain Cubillos Carvajal · Granjitas, Felix, Los Nietos · 420-12929
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Granjitas, Felix, Los Nietos','Caquetá','Morelia','Campo Alegre/Carnicerías','Libería + Aliados','420-12929',ARRAY['420-12929']::text[],'184790003000000100009000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-59D94712'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-12929');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-12929'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-12929'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-12929'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);
INSERT INTO juridica.analisis_juridico (predio_id,created_by,estado_folio,vereda_registral,fmi_matrices,fmi_derivados,acto_origen,descripcion_acto_origen,naturaleza_juridica,falsa_tradicion,procesos_judiciales,procesos_judiciales_desc,medidas_cautelares,medidas_cautelares_desc,concepto_ant,concepto_urt,concepto_pnn,observaciones)
SELECT p.id,'legal@amazoniaemprende.com','ACTIVO','Carnicerías','420-12928','NO','ADJUDICACIÓN DE BALDÍOS','RESOLUCIÓN NO. 2595 DEL 31/05/1972 del INCORA FLORENCIA y RESOLUCIÓN NO. 884 DEL 28/10/1970 del INCORA FLORENCIA','Privado',false,false,'NO ACTUALMENTE',false,'NO ACTUALMENTE',NULL,NULL,NULL,'Área registral (Excel): 107 ha + 9000 m2 (producto de dos predios) | Obs. Datos básicos: Interesada envió documentación'
FROM core.predios p WHERE p.matricula_inmobiliaria='420-12929'
  AND NOT EXISTS (SELECT 1 FROM juridica.analisis_juridico aj WHERE aj.predio_id=p.id);

-- #4 Amalia Nuñez Motta y Tomas Nuñez Motta · (sin nombre predio) · 420-73416
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,NULL,'Caquetá','Florencia','La primavera, San cristobal bajo y el reflejo',NULL,'420-73416',ARRAY['420-73416']::text[],'180010002000000050060000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-B5554166'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-73416');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-73416'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-73416'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,false,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-73416'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #5 Doris Vega Salinas · El Tesoro · 420-101847
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'El Tesoro','Caquetá','Morelia','Rochela Baja','Libería + Aliados','420-101847',ARRAY['420-101847']::text[],'184790003000000040021000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-C555D655'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-101847');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-101847'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-101847'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-101847'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);
INSERT INTO juridica.analisis_juridico (predio_id,created_by,estado_folio,vereda_registral,fmi_matrices,fmi_derivados,acto_origen,descripcion_acto_origen,naturaleza_juridica,falsa_tradicion,procesos_judiciales,procesos_judiciales_desc,medidas_cautelares,medidas_cautelares_desc,concepto_ant,concepto_urt,concepto_pnn,observaciones)
SELECT p.id,'legal@amazoniaemprende.com','ACTIVO','La Rochela','420-59596','NO REGISTRA','ADJUDICACIÓN DE BALDÍOS','RESOLUCION 10075 DEL 31-12-1964 INCORA DE BOGOTÁ','Privado',false,false,'NO ACTUALMENTE',false,'NO ACTUALMENTE',NULL,NULL,NULL,'Área registral (Excel): 40 ha | Obs. Datos básicos: Interesada envió documentación'
FROM core.predios p WHERE p.matricula_inmobiliaria='420-101847'
  AND NOT EXISTS (SELECT 1 FROM juridica.analisis_juridico aj WHERE aj.predio_id=p.id);

-- #6 Edgar Cabrera Silva · Lote · 420-30844
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Lote','Caquetá','Morelia','Las Delicias',NULL,'420-30844',ARRAY['420-30844']::text[],'184790002000000180026000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-DB2E3341'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-30844');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-30844'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-30844'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,false,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-30844'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);
INSERT INTO juridica.analisis_juridico (predio_id,created_by,estado_folio,vereda_registral,fmi_matrices,fmi_derivados,acto_origen,descripcion_acto_origen,naturaleza_juridica,falsa_tradicion,procesos_judiciales,procesos_judiciales_desc,medidas_cautelares,medidas_cautelares_desc,concepto_ant,concepto_urt,concepto_pnn,observaciones)
SELECT p.id,'legal@amazoniaemprende.com','ACTIVO','Las Delicias','410-12259','NO REGISTRA','ADJUDICACIÓN DE BALDÍOS','RESOLUCIÓN NO. 10075 DEL 31/12/1964 del INCORA BOGOTÁ','Privado',false,false,'NO ACTUALMENTE',false,'NO ACTUALMENTE',NULL,NULL,NULL,'Área registral (Excel): 4 ha | Obs. Datos básicos: Interesado envió documentación'
FROM core.predios p WHERE p.matricula_inmobiliaria='420-30844'
  AND NOT EXISTS (SELECT 1 FROM juridica.analisis_juridico aj WHERE aj.predio_id=p.id);

-- #7 Jaro Lozada Cuellar · Finca el Bosque #Lote 7 · 420-82202
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Finca el Bosque #Lote 7','Caquetá','Morelia','Lagunilla','Lagunilla','420-82202',ARRAY['420-82202']::text[],'184790002000000210023000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-AD6CDFC8'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-82202');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-82202'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-82202'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',2025,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-82202'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);
INSERT INTO juridica.analisis_juridico (predio_id,created_by,estado_folio,vereda_registral,fmi_matrices,fmi_derivados,acto_origen,descripcion_acto_origen,naturaleza_juridica,falsa_tradicion,procesos_judiciales,procesos_judiciales_desc,medidas_cautelares,medidas_cautelares_desc,concepto_ant,concepto_urt,concepto_pnn,observaciones)
SELECT p.id,'legal@amazoniaemprende.com','ACTIVO','Morelia','420-81958; 420-2538; 420-43129; 420-2539','NO REGISTRA','ADJUDICACIÓN DE BALDÍOS','RESOLUCIÓN NO. 9585 DEL 27/07/1967 del INCORA BOGOTÁ','Privado',false,false,'NO ACTUALMENTE',true,'Anotación (04) Hipoteca elevada a través de Escritura Pública No. 2999 del 12/09/2011',NULL,NULL,NULL,'Área registral (Excel): 42 ha + 2917 m2 | Tiene un gravamen de hipoteca activo, sin embargo, no constituye limitación para la constitución de una servidumbre ecológica. | Obs. Datos básicos: Interesado envió documentación'
FROM core.predios p WHERE p.matricula_inmobiliaria='420-82202'
  AND NOT EXISTS (SELECT 1 FROM juridica.analisis_juridico aj WHERE aj.predio_id=p.id);

-- #8 Maria Alejandra Cadena Cogollo · La Fortuna · 420-101352
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'La Fortuna','Caquetá','Morelia','La Virginia','Libería + Aliados','420-101352',ARRAY['420-101352']::text[],'184790003000000140007000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-1B99C1B3'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-101352');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-101352'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-101352'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,false,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-101352'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #9 José Ricardo Gutiérrez Rojas y Alicia Suárez Escobar · Los Cauchos · 420-103252
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Los Cauchos','Caquetá','Morelia','Buenos Aires','Buenos Aires','420-103252',ARRAY['420-103252']::text[],'184790002000000180017000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-A8E2D617'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-103252');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-103252'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-103252'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',2025,true,'SI, FIRMA DE LOS DOS','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-103252'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);
INSERT INTO juridica.analisis_juridico (predio_id,created_by,estado_folio,vereda_registral,fmi_matrices,fmi_derivados,acto_origen,descripcion_acto_origen,naturaleza_juridica,falsa_tradicion,procesos_judiciales,procesos_judiciales_desc,medidas_cautelares,medidas_cautelares_desc,concepto_ant,concepto_urt,concepto_pnn,observaciones)
SELECT p.id,'legal@amazoniaemprende.com','ACTIVO','Morelia','420-100891 y 420-50744','NO REGISTRA','ADJUDICACIÓN DE BALDÍOS','RESOLUCIÓN NO. 1036 DEL 23/11/1970 del INCORA','Privado',false,false,'NO ACTUALMENTE',false,'NO ACTUALMENTE',NULL,NULL,NULL,'Área registral (Excel): 75 ha + 2581 m2 | Obs. Datos básicos: Interesado envió documentación'
FROM core.predios p WHERE p.matricula_inmobiliaria='420-103252'
  AND NOT EXISTS (SELECT 1 FROM juridica.analisis_juridico aj WHERE aj.predio_id=p.id);

-- #10 Juan de Jesús Silva Silva · Villa Milena · 420-6145
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Villa Milena','Caquetá','Morelia','Buenos Aires','Buenos Aires','420-6145',ARRAY['420-6145']::text[],'184790002000000200020000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-A317A67E'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-6145');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-6145'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-6145'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',2024,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-6145'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #11 Margarita Paladinez de Fajardo · (sin nombre predio) · 420-58782
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,NULL,'Caquetá','Morelia','Campo Alegre',NULL,'420-58782',ARRAY['420-58782']::text[],'184790003000000100006000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-4B0AF9B5'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-58782');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-58782'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-58782'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-58782'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);
INSERT INTO juridica.analisis_juridico (predio_id,created_by,estado_folio,vereda_registral,fmi_matrices,fmi_derivados,acto_origen,descripcion_acto_origen,naturaleza_juridica,falsa_tradicion,procesos_judiciales,procesos_judiciales_desc,medidas_cautelares,medidas_cautelares_desc,concepto_ant,concepto_urt,concepto_pnn,observaciones)
SELECT p.id,'legal@amazoniaemprende.com','ACTIVO','Milan','NO REGISTRA','NO REGISTRA','ADJUDICACIÓN DE BALDÍOS','RESOLUCIÓN NO. 3108 DEL 29/03/1966 del INCORA','Privado',false,false,'NO ACTUALMENTE',false,'NO ACTUALMENTE',NULL,NULL,NULL,'Área registral (Excel): 48 ha | Obs. Datos básicos: Interesada envió documentación'
FROM core.predios p WHERE p.matricula_inmobiliaria='420-58782'
  AND NOT EXISTS (SELECT 1 FROM juridica.analisis_juridico aj WHERE aj.predio_id=p.id);

-- #12 Maria Bellanit Gamboa Rodriguez · La Leona · 420-82197
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'La Leona','Caquetá','Morelia','Lagunilla','Lagunilla','420-82197',ARRAY['420-82197']::text[],'184790002000000210018000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-38D60CE6'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-82197');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-82197'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-82197'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',2025,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-82197'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);
INSERT INTO juridica.analisis_juridico (predio_id,created_by,estado_folio,vereda_registral,fmi_matrices,fmi_derivados,acto_origen,descripcion_acto_origen,naturaleza_juridica,falsa_tradicion,procesos_judiciales,procesos_judiciales_desc,medidas_cautelares,medidas_cautelares_desc,concepto_ant,concepto_urt,concepto_pnn,observaciones)
SELECT p.id,'legal@amazoniaemprende.com','ACTIVO','Morelia','420-81958; 420-2538; 420-43129; 420-2539','NO REGISTRA','ADJUDICACIÓN DE BALDÍOS','RESOLUCIÓN NO. 9585 DEL 27/07/1967 del INCORA BOGOTÁ','Privado',false,false,'NO ACTUALMENTE',true,'Anotación (07) Hipoteca elevada a través de Escritura Pública No. 1385 del 13/05/2011 de la Notaría Primera de Florencia',NULL,NULL,NULL,'Área registral (Excel): 40 ha + 5000 m2 | Obs. Datos básicos: Interesado envió documentación'
FROM core.predios p WHERE p.matricula_inmobiliaria='420-82197'
  AND NOT EXISTS (SELECT 1 FROM juridica.analisis_juridico aj WHERE aj.predio_id=p.id);

-- #13 Matilde Carvajal Calderón · La Rochela hoy Alejandra · 420-30704
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'La Rochela hoy Alejandra','Caquetá','Morelia','Campo Alegre','Libería + Aliados','420-30704',ARRAY['420-30704']::text[],'184790003000000100022000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-46039A18'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-30704');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-30704'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-30704'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,false,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-30704'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);
INSERT INTO juridica.analisis_juridico (predio_id,created_by,estado_folio,vereda_registral,fmi_matrices,fmi_derivados,acto_origen,descripcion_acto_origen,naturaleza_juridica,falsa_tradicion,procesos_judiciales,procesos_judiciales_desc,medidas_cautelares,medidas_cautelares_desc,concepto_ant,concepto_urt,concepto_pnn,observaciones)
SELECT p.id,'legal@amazoniaemprende.com','ACTIVO','Canelitos','NO REGISTRA','NO REGISTRA','ADJUDICACIÓN DE BALDÍOS','RESOLUCIÓN NO. 10906 DEL 14/10/1965 del INCORA BOGOTÁ','Privado',false,false,'NO ACTUALMENTE',false,'NO ACTUALMENTE',NULL,NULL,NULL,'Área registral (Excel): 66 ha + 2400 m2 | Obs. Datos básicos: Interesada remitió documentación'
FROM core.predios p WHERE p.matricula_inmobiliaria='420-30704'
  AND NOT EXISTS (SELECT 1 FROM juridica.analisis_juridico aj WHERE aj.predio_id=p.id);

-- #15 Nelly Jaramillo Rojas · (sin nombre predio) · 420-29953
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,NULL,'Caquetá','Morelia','La Liberia',NULL,'420-29953',ARRAY['420-29953']::text[],'188600001000000130009000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-CA6A07BF'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-29953');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-29953'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-29953'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,false,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-29953'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);
INSERT INTO juridica.analisis_juridico (predio_id,created_by,estado_folio,vereda_registral,fmi_matrices,fmi_derivados,acto_origen,descripcion_acto_origen,naturaleza_juridica,falsa_tradicion,procesos_judiciales,procesos_judiciales_desc,medidas_cautelares,medidas_cautelares_desc,concepto_ant,concepto_urt,concepto_pnn,observaciones)
SELECT p.id,'legal@amazoniaemprende.com','ACTIVO','Liberia','NO REGISTRA','NO REGISTRA','ADJUDICACIÓN DE BALDÍOS','RESOLUCIÓN NO. 1773 DEL 26/11/1985 del INCORA FLORENCIA','Privado',false,false,'NO ACTUALMENTE',false,'NO ACTUALMENTE',NULL,NULL,NULL,'Área registral (Excel): 54 ha + 1250 m2 | Obs. Datos básicos: Falta documentación.'
FROM core.predios p WHERE p.matricula_inmobiliaria='420-29953'
  AND NOT EXISTS (SELECT 1 FROM juridica.analisis_juridico aj WHERE aj.predio_id=p.id);

-- #16 Fabio Silva Yosa · (sin nombre predio) · 420-14728
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,NULL,'Caquetá','Morelia','Buenos Aires','Buenos Aires','420-14728',ARRAY['420-14728']::text[],'184790002000000200010000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-6F0B1E68'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-14728');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-14728'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-14728'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',2025,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-14728'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);
INSERT INTO juridica.analisis_juridico (predio_id,created_by,estado_folio,vereda_registral,fmi_matrices,fmi_derivados,acto_origen,descripcion_acto_origen,naturaleza_juridica,falsa_tradicion,procesos_judiciales,procesos_judiciales_desc,medidas_cautelares,medidas_cautelares_desc,concepto_ant,concepto_urt,concepto_pnn,observaciones)
SELECT p.id,'legal@amazoniaemprende.com','ACTIVO','Buenos Aires','NO REGISTRA','NO REGISTRA','ADJUDICACIÓN DE BALDÍOS','RESOLUCIÓN NO. 2074 DEL 21/09/1980 del INCORA FLORENCIA','Privado',false,false,'NO ACTUALMENTE',false,'NO ACTUALMENTE',NULL,NULL,NULL,'Área registral (Excel): 15 ha + 5000 m2 | Obs. Datos básicos: Interesado envió documentación'
FROM core.predios p WHERE p.matricula_inmobiliaria='420-14728'
  AND NOT EXISTS (SELECT 1 FROM juridica.analisis_juridico aj WHERE aj.predio_id=p.id);

-- #17 Pablo Rojas Sánchez · Miraflores · 420-10730
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Miraflores','Caquetá','Morelia','Buenos Aires','Buenos Aires','420-10730',ARRAY['420-10730']::text[],'184790002000000200003000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-1C5F18E3'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-10730');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-10730'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-10730'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',2026,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-10730'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);
INSERT INTO juridica.analisis_juridico (predio_id,created_by,estado_folio,vereda_registral,fmi_matrices,fmi_derivados,acto_origen,descripcion_acto_origen,naturaleza_juridica,falsa_tradicion,procesos_judiciales,procesos_judiciales_desc,medidas_cautelares,medidas_cautelares_desc,concepto_ant,concepto_urt,concepto_pnn,observaciones)
SELECT p.id,'legal@amazoniaemprende.com','ACTIVO','Buenos Aires','420-7879','NO REGISTRA','ADJUDICACIÓN DE BALDÍOS','RESOLUCIÓN NO. 8283 DEL 01/12/1964 del INCORA BOGOTÁ','Privado',false,false,'NO ACTUALMENTE',true,'Anotación (03) Hipoteca elevada a través de Escritura Pública No. 1824 DEL 09-12-1996 NOTARIA 2. DE FLORENCIA',NULL,NULL,NULL,'Área registral (Excel): 33 ha + 625 m2 | Tiene un gravamen de hipoteca activo, sin embargo, no constituye limitación para la constitución de una servidumbre ecológica. | Obs. Datos básicos: Interesado envió documentación'
FROM core.predios p WHERE p.matricula_inmobiliaria='420-10730'
  AND NOT EXISTS (SELECT 1 FROM juridica.analisis_juridico aj WHERE aj.predio_id=p.id);

-- #18 Benjamín Vargas Castro · Las Minas · 420-33082
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Las Minas','Caquetá','Morelia','Lagunilla','Lagunilla','420-33082',ARRAY['420-33082']::text[],'184790002000000210042000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-8CD45135'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-33082');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-33082'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-33082'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',2025,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-33082'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #19 The Amazon´s International Trade Zone S.A.S. · CEILAN Y MIRANDA · 420-135579
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'CEILAN Y MIRANDA','Caquetá','Florencia','Santander',NULL,'420-135579',ARRAY['420-135579']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-716F8F6C'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-135579');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-135579'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-135579'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-135579'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #20 Richardine Losada Cuellar · (sin nombre predio) · 420-82205
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,NULL,'Caquetá','Morelia','Lagunilla',NULL,'420-82205',ARRAY['420-82205']::text[],'184790002000000210017000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-3456F327'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-82205');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-82205'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-82205'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-82205'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);
INSERT INTO juridica.analisis_juridico (predio_id,created_by,estado_folio,vereda_registral,fmi_matrices,fmi_derivados,acto_origen,descripcion_acto_origen,naturaleza_juridica,falsa_tradicion,procesos_judiciales,procesos_judiciales_desc,medidas_cautelares,medidas_cautelares_desc,concepto_ant,concepto_urt,concepto_pnn,observaciones)
SELECT p.id,'legal@amazoniaemprende.com','ACTIVO','Morelia','420-81958; 420-2538; 420-43129; 420-2539','NO REGISTRA','ADJUDICACIÓN DE BALDÍOS','RESOLUCIÓN NO. 9585 DEL 27/07/1967 del INCORA BOGOTÁ','Privado',false,false,'NO ACTUALMENTE',true,'Anotación (4) Hipoteca elevada a través de Escritura Pública 188 del 24 de julio de 2013',NULL,NULL,NULL,'Área registral (Excel): 29 ha + 2983 m2 | Tiene un gravamen de hipoteca activo, sin embargo, no constituye limitación para la constitución de una servidumbre ecológica. | Obs. Datos básicos: Interesado envió documentación'
FROM core.predios p WHERE p.matricula_inmobiliaria='420-82205'
  AND NOT EXISTS (SELECT 1 FROM juridica.analisis_juridico aj WHERE aj.predio_id=p.id);

-- #21 Álvaro Marlés Artunduaga · San Francisco Lote 1 · 420-109277
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'San Francisco Lote 1','Caquetá','Florencia','Santander',NULL,'420-109277',ARRAY['420-109277']::text[],'180010001000000100016000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-83354EFC'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-109277');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-109277'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-109277'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-109277'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #22 Álvaro Marlés Artunduaga 2 · San Francisco Lote 2 · 420-109278
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'San Francisco Lote 2','Caquetá','Florencia','Santander',NULL,'420-109278',ARRAY['420-109278']::text[],'180010001000000100135000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-E1D84E27'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-109278');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-109278'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-109278'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-109278'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #23 José Jesus Rendon Orozco · Villa Milena · 420-15115
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Villa Milena','Caquetá','Morelia','La Rochela','Libería + Aliados','420-15115',ARRAY['420-15115']::text[],'184790003000000100023000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-A15526B6'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-15115');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-15115'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-15115'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-15115'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #24 Fundación Inti Wasi · Lote · 420-129743
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Lote','Caquetá','Florencia','Santander',NULL,'420-129743',ARRAY['420-129743']::text[],'180010001000000100074000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-5275C440'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-129743');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-129743'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-129743'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-129743'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #25 Juan Carlos Ortiz Pulido · La Cabaña · 420-6542
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'La Cabaña','Caquetá','Morelia','Palmarito','Lagunilla','420-6542',ARRAY['420-6542']::text[],'184790001000000160042000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-DC902D98'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-6542');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-6542'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-6542'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-6542'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #26 Neila Lozada Ospina · La Floresta · 420-107159
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'La Floresta','Caquetá','Morelia','Lagunilla',NULL,'420-107159',ARRAY['420-107159']::text[],'184790002000000210015000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-D069624E'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-107159');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-107159'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-107159'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-107159'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #27 Cruz Mireya Casanova · El Porvenir · 420-7353
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'El Porvenir','Caquetá','Florencia','Las Damas',NULL,'420-7353',ARRAY['420-7353']::text[],'180010003000000030098000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-42EFE93B'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-7353');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-7353'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-7353'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-7353'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #28 Rafael Fajardo Ibañez · San Antonio · 420-134235
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'San Antonio','Caquetá','Florencia','San Antonio de Ateneas',NULL,'420-134235',ARRAY['420-134235']::text[],'180010002000000030068000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-38B4010B'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-134235');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-134235'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-134235'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',2026,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-134235'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #29 Camilo Alexis Osa Artunduaga · Villa Yeimy · 420-46309
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Villa Yeimy','Caquetá','Florencia','Lagunilla',NULL,'420-46309',ARRAY['420-46309']::text[],'180010001000000090034000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-7859E0F7'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-46309');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-46309'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-46309'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-46309'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #30 Luis Alfonso Meneses Triana · El Diamante · 420-70297
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'El Diamante','Caquetá','Morelia','Rochela Baja','Libería + Aliados','420-70297',ARRAY['420-70297']::text[],'184790003000000040018000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-FCE4902D'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-70297');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-70297'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-70297'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,false,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-70297'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #31 Jesús Ome Rentería · Buenavista · 420-12081
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Buenavista','Caquetá','Morelia','Campo Alegre.','Libería + Aliados','420-12081',ARRAY['420-12081']::text[],'184790003000000100010000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-A084F9BC'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-12081');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-12081'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-12081'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',2024,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-12081'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #32 Rodolfo Benavides Ortíz · El Seviv · 420-101967
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'El Seviv','Caquetá','Morelia','Rochela Baja','Libería + Aliados','420-101967',ARRAY['420-101967']::text[],'184790003000000040022000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-AD3CF778'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-101967');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-101967'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-101967'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',2025,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-101967'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #33 Diego Ramirez Osorio · San Lorenzo · 420-3428
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'San Lorenzo','Caquetá','Florencia','San Juan del Barro',NULL,'420-3428',ARRAY['420-3428']::text[],'180010001000000070022000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-7500C139'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-3428');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-3428'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-3428'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-3428'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #34 Diego Ramirez Osorio · El Rubi · 420-38376
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'El Rubi','Caquetá','Florencia','San Juan del Barro',NULL,'420-38376',ARRAY['420-38376']::text[],'180010001000000020063000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-7500C139'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-38376');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-38376'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-38376'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-38376'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #35 Alirio Salamanca Perdomo · Patio Bonito · 420-52575
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Patio Bonito','Caquetá','Florencia','La Miranda',NULL,'420-52575',ARRAY['420-52575']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-8022CA8C'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-52575');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-52575'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-52575'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-52575'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #36 Esteban Losada Ramos · La Bocana · 420-40642
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'La Bocana','Caquetá','Florencia',NULL,NULL,'420-40642',ARRAY['420-40642']::text[],'180010001000000030038000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-C6B8624C'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-40642');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-40642'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-40642'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-40642'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #37 Luz Nancy Quintero Ramirez - Esteban Losada Ramos · Finca la Florida · 420-9498
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Finca la Florida','Caquetá','Florencia','Guayabal',NULL,'420-9498',ARRAY['420-9498']::text[],'180010001000000030039000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-178A2E9B'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-9498');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-9498'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-9498'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,'LUZ NANCY SÍ, FALTA ESTEBAN LOSADA','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-9498'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #38 Luz Mireya Quina Cruz · Predio · 420-129245
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Predio','Caquetá','Morelia','Aguacaliente',NULL,'420-129245',ARRAY['420-129245']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-CA6A749B'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-129245');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-129245'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-129245'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-129245'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #39 Liliana Murcia Rivera y Sara Isabela Castillo · Finca Buena Vista · 420-88925
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Finca Buena Vista','Caquetá','Morelia','Lagunilla',NULL,'420-88925',ARRAY['420-88925']::text[],'184790002000000210033000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-B8498BD6'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-88925');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-88925'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-88925'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-88925'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #40 Gustavo Meneses Triana · Finca El Dorado · 420-133106
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Finca El Dorado','Caquetá','Morelia','Rochela Baja','Libería + Aliados','420-133106',ARRAY['420-133106']::text[],'184790003000000040028000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-B13FFBD0'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-133106');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-133106'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-133106'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-133106'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #41 Deyanira Rivera Salgado · Finca Maria Alejandra · 420-85932
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Finca Maria Alejandra','Caquetá','Florencia','Tominejo',NULL,'420-85932',ARRAY['420-85932']::text[],'180010001000000080002000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-380A5A9B'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-85932');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-85932'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-85932'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',2025,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-85932'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #42 Antonio Ricardo Perdomo · Finca el Rancho de San Luis · 420-98288
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Finca el Rancho de San Luis','Caquetá','Morelia','Las Acacias',NULL,'420-98288',ARRAY['420-98288']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-D932B36D'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-98288');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-98288'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-98288'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',2025,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-98288'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #43 Miguel Arcangel Diaz Moreno · (sin nombre predio) · 420-75613
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,NULL,'Caquetá','Morelia','Virginia',NULL,'420-75613',ARRAY['420-75613']::text[],'184790003000000070023000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-65BB5334'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-75613');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-75613'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-75613'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-75613'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #44 Kerly Suleny Jaramillo Calderon · (sin nombre predio) · 420-9909
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,NULL,'Caquetá','Morelia','Bolivia',NULL,'420-9909',ARRAY['420-9909']::text[],'184790003000000050004000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-160FAA69'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-9909');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-9909'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-9909'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-9909'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #45 María Oneida Avilés · Pendiente información SIG · s/matrícula
INSERT INTO core.predios (id,aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT '3a67c9c7-112a-469b-9e1b-62741aa201d0',a.id,'Pendiente información SIG','Caquetá','Morelia','Bolivia',NULL,NULL,NULL,NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-F215CE70'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE aliado_id=a.id AND nombre_predio IS NOT DISTINCT FROM 'Pendiente información SIG');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.id='3a67c9c7-112a-469b-9e1b-62741aa201d0'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.id='3a67c9c7-112a-469b-9e1b-62741aa201d0'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',2026,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.id='3a67c9c7-112a-469b-9e1b-62741aa201d0'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #46 Gabriel Gasca Yate · La Cruz Roja · 420-25636
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'La Cruz Roja','Caquetá','Morelia','Bruselas',NULL,'420-25636',ARRAY['420-25636']::text[],'184790003000000060006000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-839C2797'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-25636');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-25636'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-25636'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',2025,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-25636'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #47 Valentin Cuellar Rojas · Santa Martha · s/matrícula
INSERT INTO core.predios (id,aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT '16190627-ec70-4468-922c-b766c2ff5797',a.id,'Santa Martha','Caquetá','Morelia','Bajo Delicias',NULL,NULL,NULL,NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-1A17C931'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE aliado_id=a.id AND nombre_predio IS NOT DISTINCT FROM 'Santa Martha');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.id='16190627-ec70-4468-922c-b766c2ff5797'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.id='16190627-ec70-4468-922c-b766c2ff5797'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.id='16190627-ec70-4468-922c-b766c2ff5797'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #48 Azucena Blanco Torres · Lote de Terreno 6 · 420-127591
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Lote de Terreno 6','Caquetá','Morelia','Bajo Delicias',NULL,'420-127591',ARRAY['420-127591']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-00DC12F2'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-127591');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-127591'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-127591'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-127591'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #49 Luz Adriana Ramírez Sepulveda · Caracoli · 420-22118
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Caracoli','Caquetá','Morelia','Palmarito','Lagunilla','420-22118',ARRAY['420-22118']::text[],'184790001000000230003000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-874D07DC'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-22118');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-22118'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-22118'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',2024,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-22118'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #50 Ivan Marino Ortíz Pulido · LA GRANADA · 420-34109
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'LA GRANADA','Caquetá','Morelia','Palmarito','Lagunilla','420-34109',ARRAY['420-34109']::text[],'184790001000000230001000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-231581B6'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-34109');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-34109'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-34109'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',2024,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-34109'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #51 Luis Alejandro Pena Yojar · (sin nombre predio) · s/matrícula
INSERT INTO core.predios (id,aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT '89559408-fd82-40d4-84a1-ae0daf5111ce',a.id,NULL,'Caquetá','Por definir',NULL,NULL,NULL,NULL,NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-C823C28C'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE aliado_id=a.id AND nombre_predio IS NOT DISTINCT FROM NULL);
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.id='89559408-fd82-40d4-84a1-ae0daf5111ce'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.id='89559408-fd82-40d4-84a1-ae0daf5111ce'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.id='89559408-fd82-40d4-84a1-ae0daf5111ce'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #52 Maria Eugenia Franco · (sin nombre predio) · s/matrícula
INSERT INTO core.predios (id,aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT 'f04ea43d-8b67-4fef-8505-237603fed3c7',a.id,NULL,'Caquetá','Morelia','Bolivia',NULL,NULL,NULL,NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-A836CFD5'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE aliado_id=a.id AND nombre_predio IS NOT DISTINCT FROM NULL);
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.id='f04ea43d-8b67-4fef-8505-237603fed3c7'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.id='f04ea43d-8b67-4fef-8505-237603fed3c7'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',2026,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.id='f04ea43d-8b67-4fef-8505-237603fed3c7'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #53 German Jaramillo · LOS LAURELES · s/matrícula
INSERT INTO core.predios (id,aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT '51c42a2a-1e12-4f79-81c3-669ebec55207',a.id,'LOS LAURELES','Caquetá','Morelia','Bolivia',NULL,NULL,NULL,NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-53BC2115'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE aliado_id=a.id AND nombre_predio IS NOT DISTINCT FROM 'LOS LAURELES');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.id='51c42a2a-1e12-4f79-81c3-669ebec55207'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.id='51c42a2a-1e12-4f79-81c3-669ebec55207'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.id='51c42a2a-1e12-4f79-81c3-669ebec55207'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #54 Johan Carrillo · (sin nombre predio) · s/matrícula
INSERT INTO core.predios (id,aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT 'd854490d-4123-480b-94ae-66159196c4b2',a.id,NULL,'Caquetá','Por definir',NULL,NULL,NULL,NULL,'184790003000000140012000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-9E30937A'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE aliado_id=a.id AND nombre_predio IS NOT DISTINCT FROM NULL);
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.id='d854490d-4123-480b-94ae-66159196c4b2'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.id='d854490d-4123-480b-94ae-66159196c4b2'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.id='d854490d-4123-480b-94ae-66159196c4b2'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #55 Escuela bosque-Florencia · FINCA SAN ISIDRO · 420-99639
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'FINCA SAN ISIDRO','Caquetá','Florencia','La Sardina',NULL,'420-99639',ARRAY['420-99639']::text[],'180010002000000031526000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-E2F0C6B5'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-99639');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-99639'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-99639'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-99639'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #56 Escuela bosque-Morelia · (sin nombre predio) · s/matrícula
INSERT INTO core.predios (id,aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT 'aa2500db-785e-44b0-8699-4cde81b251be',a.id,NULL,'Caquetá','Morelia',NULL,NULL,NULL,NULL,'184790002000000210029000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-B6410A9A'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE aliado_id=a.id AND nombre_predio IS NOT DISTINCT FROM NULL);
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.id='aa2500db-785e-44b0-8699-4cde81b251be'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.id='aa2500db-785e-44b0-8699-4cde81b251be'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.id='aa2500db-785e-44b0-8699-4cde81b251be'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #58 Antonio Maria Calderon Gomez · (sin nombre predio) · 420-126772
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,NULL,'Caquetá','Morelia','Bajo Delicias',NULL,'420-126772',ARRAY['420-126772']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-B61F9F77'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-126772');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-126772'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-126772'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-126772'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #59 Marta Cecilia Guzman · reserva natural 1 · s/matrícula
INSERT INTO core.predios (id,aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT '7dbe1eec-d407-4d7a-9e15-7793f7b9023a',a.id,'reserva natural 1','Caquetá','Florencia',NULL,NULL,NULL,NULL,NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-69105DE0'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE aliado_id=a.id AND nombre_predio IS NOT DISTINCT FROM 'reserva natural 1');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.id='7dbe1eec-d407-4d7a-9e15-7793f7b9023a'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.id='7dbe1eec-d407-4d7a-9e15-7793f7b9023a'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,true,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.id='7dbe1eec-d407-4d7a-9e15-7793f7b9023a'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #60 Esteban Losada Ramos · Buenos Aires · 420-33677
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Buenos Aires','Caquetá','Florencia',NULL,NULL,'420-33677',ARRAY['420-33677']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-C6B8624C'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-33677');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-33677'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-33677'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-33677'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #61 Alirio Salamanca Perdomo · San Jose · s/matrícula
INSERT INTO core.predios (id,aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT '28cf5791-578e-498f-8c64-d54d510608fe',a.id,'San Jose','Caquetá','Florencia',NULL,NULL,NULL,NULL,NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-8022CA8C'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE aliado_id=a.id AND nombre_predio IS NOT DISTINCT FROM 'San Jose');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.id='28cf5791-578e-498f-8c64-d54d510608fe'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.id='28cf5791-578e-498f-8c64-d54d510608fe'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.id='28cf5791-578e-498f-8c64-d54d510608fe'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #62 Benjamin Rodriguez Díaz · La Serena / El vergel · 420-27428
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'La Serena / El vergel','Caquetá','Florencia','Vuelta del gallo',NULL,'420-27428',ARRAY['420-27428']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-3FA00814'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-27428');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-27428'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-27428'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-27428'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #64 Luz Marina Macias Acosta · La Patagonia · 420-23366
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'La Patagonia','Caquetá','Florencia','Bodoquero/Lagunilla',NULL,'420-23366',ARRAY['420-23366']::text[],'180010001000000060009000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-21ADBDC5'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-23366');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-23366'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-23366'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-23366'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #None Jose Lizardo Medina Benitez · La Esperanza · 420-15384
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'La Esperanza','Caquetá','Morelia','La viciosa',NULL,'420-15384',ARRAY['420-15384']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-25BE43FC'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-15384');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-15384'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-15384'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-15384'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #1 Arnulfo Barahona Torres · Lote / Hato nuevo · 420-136095
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Lote / Hato nuevo','Caquetá','Morelia','Palmarito',NULL,'420-136095',ARRAY['420-136095']::text[],'184790002000000010001000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-EF4E62FB'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-136095');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-136095'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-136095'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-136095'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #2 Bruno Mosquera Plazas · Versalles · 420-16548
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Versalles','Caquetá','Morelia','Bajo delicias.',NULL,'420-16548',ARRAY['420-16548']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-B2F8E712'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-16548');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-16548'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-16548'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-16548'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #3 Carlos Andres Jaramillo Suarez · El Paraiso · 420-112297
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'El Paraiso','Caquetá','Florencia','Agua Blanca',NULL,'420-112297',ARRAY['420-112297']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-0074F433'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-112297');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-112297'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-112297'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-112297'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #4 Carlos Jamir Osorio Mosquera · El Carmen · 420-16438
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'El Carmen','Caquetá','Morelia','Carnicerias',NULL,'420-16438',ARRAY['420-16438']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-211608F5'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-16438');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-16438'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-16438'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-16438'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #5 Cristobal Tapiero · La Dalia · 420-15584
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'La Dalia','Caquetá','Morelia','San Marcos',NULL,'420-15584',ARRAY['420-15584']::text[],'184790003000000020024000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-38131547'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-15584');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-15584'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-15584'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-15584'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #6 Edilberto Lozano Vargas · Buenos Aires · 420-4421
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Buenos Aires','Caquetá','Morelia','Rochela alta/Santa Rosa',NULL,'420-4421',ARRAY['420-4421']::text[],'184790003000000020082000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='11250089'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-4421');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-4421'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-4421'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-4421'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #7 Edilberto Lozano Vargas · Buena Vista hoy La Esperanza · 420-39366
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Buena Vista hoy La Esperanza','Caquetá','Morelia','Rochela alta/Santa Rosa',NULL,'420-39366',ARRAY['420-39366']::text[],'184790003000000020081000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='11250089'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-39366');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-39366'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-39366'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-39366'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #8 Jesus Emilio Beltrán Ballesteros · Sin nombre relacionado · 420-133888
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Sin nombre relacionado','Caquetá','Florencia','Vuelta del gallo',NULL,'420-133888',ARRAY['420-133888']::text[],'180010001000000100009000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-FD1C14DF'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-133888');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-133888'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-133888'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-133888'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #10 Faiber Andrés Salazar Pena · La Granja de Lady · 420-98299
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'La Granja de Lady','Caquetá','Florencia','La viciosa',NULL,'420-98299',ARRAY['420-98299']::text[],'180010001000000030040000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-B537CAB7'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-98299');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-98299'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-98299'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-98299'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #11 Gustavo Adolfo Hermida Echeverry · Parcela · 420-136592
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Parcela','Caquetá','Florencia','El carmen km36/Bodoquero',NULL,'420-136592',ARRAY['420-136592']::text[],'180010001000000060013000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-E3BC99F8'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-136592');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-136592'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-136592'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-136592'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #12 Hernando Cuellar Cardenas · Parcela No 4 · 420-63468
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Parcela No 4','Caquetá','Morelia','Santa Rosa',NULL,'420-63468',ARRAY['420-63468']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-96D0A263'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-63468');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-63468'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-63468'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-63468'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #13 Jaime Lozano Tapiero · Sin dirección parcela No. 2 · 420-67610
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Sin dirección parcela No. 2','Caquetá','Morelia','Bocagrande aguacaliente',NULL,'420-67610',ARRAY['420-67610']::text[],'184790003000000010232000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-8F41215A'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-67610');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-67610'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-67610'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-67610'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #14 Jose Francés Caicedo Montaño y Nubia Murcia Gongora · Lote · 420-59850
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Lote','Caquetá','Morelia','Santa rosa',NULL,'420-59850',ARRAY['420-59850']::text[],'184790003000000020187000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-672EB15D'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-59850');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-59850'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-59850'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-59850'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #15 Jose Francés Caicedo Montaño y Nubia Murcia Gongora · Parcela #1 · 420-63473
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Parcela #1','Caquetá','Morelia','Santa rosa',NULL,'420-63473',ARRAY['420-63473']::text[],'184790003000000020173000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-672EB15D'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-63473');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-63473'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-63473'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-63473'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #16 Jose Erminso Prada Carrillo · Parcela #1 · 420-67808
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Parcela #1','Caquetá','Morelia','Bocagrande aguacaliente',NULL,'420-67808',ARRAY['420-67808']::text[],'184790003000000010231000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-FF22A4A2'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-67808');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-67808'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-67808'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-67808'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #17 Jose Miller Rojas Vargas · Primavera · 420-28227
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Primavera','Caquetá','Florencia','La viciosa',NULL,'420-28227',ARRAY['420-28227']::text[],'180010001000000030018000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-2B0248DD'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-28227');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-28227'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-28227'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-28227'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #18 Luis Fernando Suarez Barragan · La Primavera · 420-102809
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'La Primavera','Caquetá','Morelia','Bajo Delicias/San Marcos',NULL,'420-102809',ARRAY['420-102809']::text[],'184790003000000020019000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-80DBD7A7'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-102809');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-102809'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-102809'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-102809'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #19 Luis Fernando Suarez Barragan · Finca Santa Maria · 420-98290
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Finca Santa Maria','Caquetá','Morelia','Bajo Delicias/San Marcos',NULL,'420-98290',ARRAY['420-98290']::text[],'184790003000000020220000000000','legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-80DBD7A7'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-98290');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-98290'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-98290'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-98290'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #20 MARELLY RUIZ RENGIFO · Parcela 10 · 420-67609
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Parcela 10','Caquetá','Morelia',NULL,NULL,'420-67609',ARRAY['420-67609']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-A4FC503C'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-67609');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-67609'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-67609'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-67609'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #21 Noel Plazas Artunduaga · Las Brisas · 420-32246
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Las Brisas','Caquetá','Florencia','Bodoquero/Lagunilla',NULL,'420-32246',ARRAY['420-32246']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-39F9CDB7'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-32246');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-32246'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-32246'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-32246'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #22 Noel Plazas Artunduaga · Buenos Aires · 420-32239
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Buenos Aires','Caquetá','Florencia',NULL,NULL,'420-32239',ARRAY['420-32239']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-39F9CDB7'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-32239');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-32239'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-32239'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-32239'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #23 Ricardo Gomez Perdomo · Lote. Barcelona · 420-60707
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Lote. Barcelona','Caquetá','Florencia',NULL,NULL,'420-60707',ARRAY['420-60707']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-2628B7DA'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-60707');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-60707'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-60707'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-60707'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #24 Ricardo Gomez Perdomo · Finca Pensilvania · 420-97052
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Finca Pensilvania','Caquetá','Florencia','Lagunilla',NULL,'420-97052',ARRAY['420-97052']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-2628B7DA'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-97052');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-97052'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-97052'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-97052'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #41 (sin propietario) · Lote terreno 1 . Buenos Aires · 420-124809
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Lote terreno 1 . Buenos Aires','Caquetá','Morelia','Santa Rosa',NULL,'420-124809',ARRAY['420-124809']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-SINPROP'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-124809');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-124809'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-124809'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-124809'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #42 Leonardo Jimenez Ome · Parcela #6 · 420-63472
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Parcela #6','Caquetá','Morelia','Morelia',NULL,'420-63472',ARRAY['420-63472']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-05BE813B'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-63472');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-63472'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-63472'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-63472'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #43 Jose Lizardo Medina Benitez · Finca La Florida · 420-85052
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Finca La Florida','Caquetá','Florencia','La viciosa',NULL,'420-85052',ARRAY['420-85052']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-25BE43FC'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-85052');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-85052'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-85052'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-85052'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #44 Jairo Loaiza Leon · Dos Quebradas · 420-33553
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Dos Quebradas','Caquetá','Morelia','San Marcos',NULL,'420-33553',ARRAY['420-33553']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-12EC32EA'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-33553');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-33553'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-33553'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-33553'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #45 Jhon Edinson Anacona Murcia · Finca Parcela · 420-67582
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Finca Parcela','Caquetá','Morelia','Morelia',NULL,'420-67582',ARRAY['420-67582']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-ECE3ADCF'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-67582');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-67582'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-67582'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-67582'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #46 Jhon Edinson Anacona Murcia · Parcela #4 · 420-73922
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Parcela #4','Caquetá','Morelia','Morelia',NULL,'420-73922',ARRAY['420-73922']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-ECE3ADCF'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-73922');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-73922'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-73922'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-73922'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #47 Javier Avila Martinez · LA ESMERALDA · 420-57338
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'LA ESMERALDA','Caquetá','Morelia','Santa Rosa',NULL,'420-57338',ARRAY['420-57338']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-E3F111B5'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-57338');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-57338'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-57338'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-57338'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #48 Javier Avila Martinez · CRISTALINA · 420-49020
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'CRISTALINA','Caquetá','Morelia','San Marcos',NULL,'420-49020',ARRAY['420-49020']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-E3F111B5'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-49020');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-49020'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-49020'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-49020'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #49 Juan Sebastian Claros Gutierrez · PARCELA 1 REFUGIO · 420-34835
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'PARCELA 1 REFUGIO','Caquetá','Florencia','Florencia',NULL,'420-34835',ARRAY['420-34835']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-B8FD5DB8'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-34835');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-34835'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-34835'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-34835'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #50 Leonardo Jimenez Ome · FINCA PROVIDENCIA · 420-100721
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'FINCA PROVIDENCIA','Caquetá','Morelia','Lagunilla',NULL,'420-100721',ARRAY['420-100721']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-05BE813B'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-100721');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-100721'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-100721'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-100721'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #None Luis Alfonso Lopez Archila · Sin nombre relacionado · 420-98312
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'Sin nombre relacionado','Caquetá','Morelia','La viciosa',NULL,'420-98312',ARRAY['420-98312']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-30CDE5D3'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-98312');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-98312'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-98312'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-98312'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #None Luis Felipe Florez · EL DIAMANTE · 420-39552
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'EL DIAMANTE','Caquetá','Morelia','Carnicerias',NULL,'420-39552',ARRAY['420-39552']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-5D572210'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-39552');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-39552'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-39552'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-39552'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #None Luis Felipe Florez · FINCA EL DIAMANTE · 420-85497
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'FINCA EL DIAMANTE','Caquetá','Morelia','Carnicerias',NULL,'420-85497',ARRAY['420-85497']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-5D572210'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-85497');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-85497'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-85497'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-85497'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #None Luis Felipe Florez · FINCA EL DIAMANTE 1 · 420-85498
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'FINCA EL DIAMANTE 1','Caquetá','Morelia','Carnicerias',NULL,'420-85498',ARRAY['420-85498']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-5D572210'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-85498');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-85498'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-85498'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-85498'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #None Mesias Mavesoy Arregui · FINCA LA FLORIDA · 420-101721
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'FINCA LA FLORIDA','Caquetá','Florencia','La Miranda',NULL,'420-101721',ARRAY['420-101721']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-FDD446E9'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-101721');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-101721'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-101721'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-101721'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

-- #None Maria Cristina Umaña Monje · EL PALMAR" LOTE N°4 · 420-122825
INSERT INTO core.predios (aliado_id,nombre_predio,departamento,municipio,vereda,zona_ae,matricula_inmobiliaria,matriculas,codigo_catastral,created_by)
SELECT a.id,'EL PALMAR" LOTE N°4','Caquetá','Florencia','Florencia',NULL,'420-122825',ARRAY['420-122825']::text[],NULL,'legal@amazoniaemprende.com'
FROM core.aliados a WHERE a.numero_documento='S/D-C846B1AC'
  AND NOT EXISTS (SELECT 1 FROM core.predios WHERE matricula_inmobiliaria='420-122825');
INSERT INTO core.predio_propietarios (predio_id,aliado_id,rol)
SELECT p.id,p.aliado_id,'principal' FROM core.predios p WHERE p.matricula_inmobiliaria='420-122825'
  AND NOT EXISTS (SELECT 1 FROM core.predio_propietarios pp WHERE pp.predio_id=p.id AND pp.aliado_id=p.aliado_id);
INSERT INTO core.expedientes (predio_id,etapa,estado,created_by)
SELECT p.id,'juridica','activo','legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-122825'
  AND NOT EXISTS (SELECT 1 FROM core.expedientes e WHERE e.predio_id=p.id);
INSERT INTO juridica.debida_diligencia (predio_id,estado,anio_ultimo_pago_predial,manifestacion_interes,manifestacion_observaciones,created_by)
SELECT p.id,'borrador',NULL,NULL,NULL,'legal@amazoniaemprende.com' FROM core.predios p WHERE p.matricula_inmobiliaria='420-122825'
  AND NOT EXISTS (SELECT 1 FROM juridica.debida_diligencia dd WHERE dd.predio_id=p.id);

COMMIT;
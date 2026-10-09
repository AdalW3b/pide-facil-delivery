-- V40 marco "sin preparacion" toda categoria con "refresco" en el nombre, y
-- alcanzo bebidas que si se preparan ("Aguas Frescas y Refrescos": limonada,
-- agua de coco). Solo nacen listos los embotellados, reconocidos por su nombre.
UPDATE products SET sin_preparacion = false
WHERE sin_preparacion
  AND NOT (name ILIKE '%coca-cola%' OR name ILIKE '%coca cola%' OR name ILIKE '%cocacola%'
           OR name ILIKE '%refresco%' OR name ILIKE '%agua embotellada%' OR name ILIKE '%agua natural%'
           OR name ILIKE '%agua mineral%' OR name ILIKE '%topo chico%' OR name ILIKE '%pe_afiel%'
           OR name ILIKE '%sprite%' OR name ILIKE '%fanta%' OR name ILIKE '%pepsi%' OR name ILIKE '%squirt%'
           OR name ILIKE '%jarrito%' OR name ILIKE '%sidral%' OR name ILIKE '%manzanita%');

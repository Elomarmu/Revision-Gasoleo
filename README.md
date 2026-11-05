# Revisión del precio del transporte por gasóleo

Calculadora gratuita de la revisión obligatoria del precio del transporte de mercancías por carretera según la variación del precio del gasóleo (Ley 15/2009, art. 38, y Orden FOM/1882/2012, condición 3.4, en la redacción de los RDL 9/2026 y 18/2026).

- Calcula G (variación del gasóleo), el coeficiente C según el tipo de vehículo y el importe a revisar (ΔP = G × P × C / 100).
- Cada precio puede ser el de una fecha (primera semana publicada igual o posterior) o la media de un mes.
- Permite elegir a cuántos decimales se redondea G antes de multiplicarlo por C.
- Los precios salen de la Excel semanal del Ministerio de Transportes y se actualizan solos.

## Cómo se actualizan los datos

`.github/workflows/actualizar.yml` ejecuta `scripts/actualizar.py` los miércoles, jueves y viernes. El script busca en la página del Ministerio el enlace a la última Excel, la descarga, lee las hojas «PRECIOS_DEL_GASOLEO» y «PRECIOS DE REFERENCIA» y, si hay cambios, guarda `data.json`. La página `index.html` lee ese fichero.

Los logotipos de `img/` son los de la app DECA Trimodos.

Para forzar una actualización: pestaña **Actions** → «Actualizar precios del gasóleo» → **Run workflow**.

## Formato de data.json

Cada fila de `rows` es `[fecha (serial Excel), PVP, PVP sin IVA, impuesto hidrocarburos, PAI, devolución gasóleo profesional, Pmed MMA ≥ 7,5 t, Pmed MMA < 7,5 t]`, en €/litro.

## Aviso

Herramienta orientativa. Para un litigio o una reclamación, contrasta el resultado con la calculadora oficial del Ministerio de Transportes.

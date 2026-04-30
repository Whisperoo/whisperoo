-- Migration Part 3: Backfill translations for Infant 6-12m + Toddler 12-24m

-- ═══════════════════════════════════════
-- INFANT 6-12 Months
-- ═══════════════════════════════════════
UPDATE care_checklist_templates SET
  title_es = 'Programar visita de los 9 meses',
  title_vi = 'Đặt lịch khám 9 tháng',
  description_es = 'Evaluación del desarrollo y control de crecimiento.',
  description_vi = 'Sàng lọc phát triển và đánh giá tăng trưởng.'
WHERE stage = 'infant_6_12m' AND title ILIKE '%9-month%';

UPDATE care_checklist_templates SET
  title_es = 'Programar vacunas de los 12 meses',
  title_vi = 'Đặt lịch tiêm chủng 12 tháng',
  description_es = 'MMR, Varicela, HepA y dosis de refuerzo.',
  description_vi = 'MMR, Thủy đậu, Viêm gan A và liều nhắc lại.'
WHERE stage = 'infant_6_12m' AND title ILIKE '%12-month%immun%';

UPDATE care_checklist_templates SET
  title_es = 'Programar visita pediátrica de los 12 meses',
  title_vi = 'Đặt lịch khám bác sĩ nhi 12 tháng',
  description_es = 'Vacunas MMR y varicela, prueba de plomo.',
  description_vi = 'Tiêm chủng MMR và thủy đậu, xét nghiệm chì.'
WHERE stage = 'infant_6_12m' AND title ILIKE '%12-month pediatrician%';

UPDATE care_checklist_templates SET
  title_es = 'Certificación de RCP para cuidadores',
  title_vi = 'Chứng nhận CPR cho người chăm sóc',
  description_es = 'Completa un curso de RCP y primeros auxilios para bebés/niños.',
  description_vi = 'Hoàn thành khóa học CPR và sơ cứu cho trẻ sơ sinh/trẻ em.'
WHERE stage = 'infant_6_12m' AND title ILIKE '%CPR%';

UPDATE care_checklist_templates SET
  title_es = 'Transición al vaso con boquilla',
  title_vi = 'Chuyển sang cốc tập uống',
  description_es = 'Comienza a introducir un vaso con boquilla junto con la lactancia o biberón.',
  description_vi = 'Bắt đầu giới thiệu cốc tập uống cùng với bú mẹ hoặc bú bình.'
WHERE stage = 'infant_6_12m' AND title ILIKE '%sippy cup%';

UPDATE care_checklist_templates SET
  title_es = 'Introducir variedad de alimentos sólidos',
  title_vi = 'Giới thiệu đa dạng thực phẩm đặc',
  description_es = 'Ofrece una variedad de texturas y sabores — frutas, verduras, proteínas, granos.',
  description_vi = 'Cho bé thử đa dạng kết cấu và hương vị — trái cây, rau, protein, ngũ cốc.'
WHERE stage = 'infant_6_12m' AND title ILIKE '%variety of solid%';

UPDATE care_checklist_templates SET
  title_es = 'Comenzar a introducir sólidos',
  title_vi = 'Bắt đầu cho ăn dặm',
  description_es = 'Purés de frutas, verduras y alimentos ricos en hierro.',
  description_vi = 'Các loại trái cây, rau và thực phẩm giàu sắt xay nhuyễn.'
WHERE stage = 'infant_6_12m' AND title ILIKE '%Begin introducing solids%';

UPDATE care_checklist_templates SET
  title_es = 'Asegurar tu hogar para el bebé',
  title_vi = 'An toàn hóa nhà cho bé',
  description_es = 'Cerraduras de gabinetes, cubiertas de enchufes, puertas en escaleras.',
  description_vi = 'Khóa tủ, che ổ cắm điện, cổng chắn cầu thang.'
WHERE stage = 'infant_6_12m' AND title ILIKE '%Baby-proof your home%';

UPDATE care_checklist_templates SET
  title_es = 'Observar hitos de sentarse y gatear',
  title_vi = 'Theo dõi cột mốc ngồi và bò',
  description_es = 'La mayoría de los bebés se sientan solos a los 6-9 meses y gatean a los 9-10 meses.',
  description_vi = 'Hầu hết trẻ ngồi được lúc 6-9 tháng và bò lúc 9-10 tháng.'
WHERE stage = 'infant_6_12m' AND title ILIKE '%sitting and crawling%';

UPDATE care_checklist_templates SET
  title_es = 'Introducir vaso para agua',
  title_vi = 'Giới thiệu cốc uống nước',
  description_es = 'Alrededor de los 6-9 meses, introduce un vaso con boquilla o abierto.',
  description_vi = 'Khoảng 6-9 tháng, giới thiệu cốc tập uống hoặc cốc mở.'
WHERE stage = 'infant_6_12m' AND title ILIKE '%Introduce a cup%';

-- ═══════════════════════════════════════
-- TODDLER 12-24 Months
-- ═══════════════════════════════════════
UPDATE care_checklist_templates SET
  title_es = 'Programar visita de los 15 meses',
  title_vi = 'Đặt lịch khám 15 tháng',
  description_es = 'Visita de rutina y vacunas de refuerzo pendientes.',
  description_vi = 'Khám sức khỏe định kỳ và tiêm chủng bổ sung.'
WHERE stage = 'toddler_12_24m' AND title ILIKE '%15-month%';

UPDATE care_checklist_templates SET
  title_es = 'Programar visita de los 18 meses',
  title_vi = 'Đặt lịch khám 18 tháng',
  description_es = 'Evaluación del desarrollo incluyendo evaluación del espectro autista.',
  description_vi = 'Sàng lọc phát triển bao gồm đánh giá phổ tự kỷ.'
WHERE stage = 'toddler_12_24m' AND title ILIKE '%18-month%';

UPDATE care_checklist_templates SET
  title_es = 'Evaluar el desarrollo del habla',
  title_vi = 'Đánh giá phát triển ngôn ngữ',
  description_es = 'Discute las primeras palabras y hitos del lenguaje con tu pediatra.',
  description_vi = 'Thảo luận về những từ đầu tiên và cột mốc ngôn ngữ với bác sĩ nhi.'
WHERE stage = 'toddler_12_24m' AND title ILIKE '%speech%';

UPDATE care_checklist_templates SET
  title_es = 'Actualizar protección infantil para movilidad',
  title_vi = 'Cập nhật an toàn cho trẻ biết đi',
  description_es = 'Reevalúa la seguridad a medida que el niño trepa, camina y explora más.',
  description_vi = 'Đánh giá lại an toàn khi trẻ leo trèo, đi lại và khám phá nhiều hơn.'
WHERE stage = 'toddler_12_24m' AND title ILIKE '%childproofing%';

UPDATE care_checklist_templates SET
  title_es = 'Establecer horario de comidas consistente',
  title_vi = 'Thiết lập lịch ăn nhất quán',
  description_es = 'Pasa a 3 comidas y 2 meriendas diarias con porciones apropiadas para la edad.',
  description_vi = 'Chuyển sang 3 bữa ăn và 2 bữa phụ mỗi ngày với khẩu phần phù hợp theo tuổi.'
WHERE stage = 'toddler_12_24m' AND title ILIKE '%meal schedule%';

-- ═══════════════════════════════════════
-- Catch-all: Set any remaining NULL translations to match English
-- This ensures future tenant-added templates fall back gracefully
-- ═══════════════════════════════════════
-- (No-op — the frontend already falls back to English when _es/_vi are NULL)

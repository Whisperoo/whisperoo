-- Migration Part 2: Backfill translations for Newborn + Infant stages

-- ═══════════════════════════════════════
-- NEWBORN 0-3 Months
-- ═══════════════════════════════════════
UPDATE care_checklist_templates SET
  title_es = 'Programar visita de las 2 semanas',
  title_vi = 'Đặt lịch khám 2 tuần',
  description_es = 'Primera visita pediátrica para verificar aumento de peso, ictericia y alimentación.',
  description_vi = 'Lần khám nhi đầu tiên để kiểm tra tăng cân, vàng da và cho ăn.'
WHERE stage = 'newborn_0_3m' AND title ILIKE '%2-week%' AND title ILIKE '%checkup%';

UPDATE care_checklist_templates SET
  title_es = 'Programar visita pediátrica de las 2 semanas',
  title_vi = 'Đặt lịch khám bác sĩ nhi 2 tuần',
  description_es = 'Primer control de peso y evaluación general de salud después del nacimiento.',
  description_vi = 'Kiểm tra cân nặng lần đầu và đánh giá sức khỏe tổng thể sau sinh.'
WHERE stage = 'newborn_0_3m' AND title ILIKE '%2-week pediatrician%';

UPDATE care_checklist_templates SET
  title_es = 'Programar visita del 1 mes',
  title_vi = 'Đặt lịch khám 1 tháng',
  description_es = 'Chequeo de rutina incluyendo medición de crecimiento y evaluación del desarrollo.',
  description_vi = 'Khám sức khỏe định kỳ bao gồm đo tăng trưởng và đánh giá phát triển.'
WHERE stage = 'newborn_0_3m' AND title ILIKE '%1-month%';

UPDATE care_checklist_templates SET
  title_es = 'Programar vacunas de los 2 meses',
  title_vi = 'Đặt lịch tiêm chủng 2 tháng',
  description_es = 'Primera ronda de vacunas incluyendo DTaP, IPV, Hib, HepB, PCV13 y Rotavirus.',
  description_vi = 'Đợt tiêm chủng đầu tiên bao gồm DTaP, IPV, Hib, HepB, PCV13 và Rotavirus.'
WHERE stage = 'newborn_0_3m' AND title ILIKE '%2-month%immun%';

UPDATE care_checklist_templates SET
  title_es = 'Programar visita pediátrica de los 2 meses',
  title_vi = 'Đặt lịch khám bác sĩ nhi 2 tháng',
  description_es = 'Segunda ronda de vacunas y control de crecimiento.',
  description_vi = 'Đợt tiêm chủng thứ hai và kiểm tra tăng trưởng.'
WHERE stage = 'newborn_0_3m' AND title ILIKE '%2-month pediatrician%';

UPDATE care_checklist_templates SET
  title_es = 'Comenzar tiempo boca abajo diariamente',
  title_vi = 'Bắt đầu tập nằm sấp hàng ngày',
  description_es = 'Comienza con unos minutos diarios sobre una superficie firme para fortalecer cuello y tronco.',
  description_vi = 'Bắt đầu với vài phút mỗi ngày trên bề mặt phẳng cứng để tăng cường cơ cổ và thân.'
WHERE stage = 'newborn_0_3m' AND title ILIKE '%tummy time%';

UPDATE care_checklist_templates SET
  title_es = 'Establecer rutina de alimentación',
  title_vi = 'Thiết lập lịch cho ăn',
  description_es = 'Trabaja con tu médico o consultora de lactancia para establecer un horario de alimentación consistente.',
  description_vi = 'Làm việc với bác sĩ hoặc tư vấn viên cho con bú để thiết lập lịch cho ăn nhất quán.'
WHERE stage = 'newborn_0_3m' AND title ILIKE '%feeding routine%';

UPDATE care_checklist_templates SET
  title_es = 'Verificar configuración de sueño seguro',
  title_vi = 'Kiểm tra thiết lập giấc ngủ an toàn',
  description_es = 'Asegúrate de que la cuna cumpla con las pautas de sueño seguro — colchón firme, sin ropa de cama suelta, boca arriba.',
  description_vi = 'Đảm bảo nôi tuân thủ hướng dẫn ngủ an toàn — nệm cứng, không ga trải giường lỏng, nằm ngửa.'
WHERE stage = 'newborn_0_3m' AND title ILIKE '%safe sleep%';

UPDATE care_checklist_templates SET
  title_es = 'Completar prueba de audición del recién nacido',
  title_vi = 'Hoàn thành kiểm tra thính giác sơ sinh',
  description_es = 'Generalmente se realiza en el hospital antes del alta.',
  description_vi = 'Thường được thực hiện tại bệnh viện trước khi xuất viện.'
WHERE stage = 'newborn_0_3m' AND title ILIKE '%hearing screening%';

UPDATE care_checklist_templates SET
  title_es = 'Registrar pañales mojados y sucios',
  title_vi = 'Theo dõi tã ướt và bẩn',
  description_es = 'Mínimo 6 pañales mojados por día indica alimentación adecuada.',
  description_vi = 'Tối thiểu 6 tã ướt mỗi ngày cho thấy bé bú đủ.'
WHERE stage = 'newborn_0_3m' AND title ILIKE '%diaper%';

UPDATE care_checklist_templates SET
  title_es = 'Programar chequeo obstétrico postparto (6 semanas)',
  title_vi = 'Đặt lịch khám sản khoa sau sinh (6 tuần)',
  description_es = 'Tu propio chequeo de recuperación — bienestar físico y emocional.',
  description_vi = 'Kiểm tra phục hồi của bạn — sức khỏe thể chất và tinh thần.'
WHERE stage = 'newborn_0_3m' AND title ILIKE '%postpartum OB%';

UPDATE care_checklist_templates SET
  title_es = 'Registrar el certificado de nacimiento del bebé',
  title_vi = 'Đăng ký giấy khai sinh cho bé',
  description_es = 'Requerido dentro de los 10 días del nacimiento en la mayoría de los estados.',
  description_vi = 'Bắt buộc trong vòng 10 ngày sau sinh ở hầu hết các tiểu bang.'
WHERE stage = 'newborn_0_3m' AND title ILIKE '%birth certificate%';

-- ═══════════════════════════════════════
-- INFANT 3-6 Months
-- ═══════════════════════════════════════
UPDATE care_checklist_templates SET
  title_es = 'Programar visita de los 4 meses',
  title_vi = 'Đặt lịch khám 4 tháng',
  description_es = 'Visita de rutina y segunda ronda de vacunas.',
  description_vi = 'Khám sức khỏe định kỳ và đợt tiêm chủng thứ hai.'
WHERE stage = 'infant_3_6m' AND title ILIKE '%4-month%';

UPDATE care_checklist_templates SET
  title_es = 'Discutir preparación para alimentos sólidos',
  title_vi = 'Thảo luận về sẵn sàng ăn dặm',
  description_es = 'Habla con tu pediatra sobre los signos de preparación para introducir sólidos.',
  description_vi = 'Trao đổi với bác sĩ nhi về các dấu hiệu sẵn sàng ăn dặm.'
WHERE stage = 'infant_3_6m' AND title ILIKE '%solid food%';

UPDATE care_checklist_templates SET
  title_es = 'Asegurar las áreas principales del hogar',
  title_vi = 'An toàn hóa khu vực sinh hoạt chính',
  description_es = 'Cubre enchufes, asegura muebles y retira peligros de asfixia.',
  description_vi = 'Che ổ cắm điện, cố định đồ nội thất và loại bỏ các nguy cơ nghẹn.'
WHERE stage = 'infant_3_6m' AND title ILIKE '%baby-proof%' OR (stage = 'infant_3_6m' AND title ILIKE '%Baby-proof%');

UPDATE care_checklist_templates SET
  title_es = 'Programar revisión dental de los 6 meses',
  title_vi = 'Đặt lịch khám răng 6 tháng',
  description_es = 'Primera visita dental recomendada dentro de los 6 meses del primer diente o antes del año.',
  description_vi = 'Lần khám răng đầu tiên được khuyến nghị trong vòng 6 tháng sau khi mọc răng đầu tiên hoặc trước 1 tuổi.'
WHERE stage = 'infant_3_6m' AND title ILIKE '%dental%';

UPDATE care_checklist_templates SET
  title_es = 'Seguir hitos del desarrollo',
  title_vi = 'Theo dõi cột mốc phát triển',
  description_es = 'Observa si rueda, alcanza objetos, balbucea y sonríe socialmente.',
  description_vi = 'Theo dõi việc lật người, với đồ vật, bập bẹ và cười xã hội.'
WHERE stage = 'infant_3_6m' AND title ILIKE '%developmental milestones%';

UPDATE care_checklist_templates SET
  title_es = 'Programar visita pediátrica de los 6 meses',
  title_vi = 'Đặt lịch khám bác sĩ nhi 6 tháng',
  description_es = 'Vacuna contra la gripe si es temporada, revisión continua del desarrollo.',
  description_vi = 'Tiêm phòng cúm nếu đúng mùa, tiếp tục đánh giá phát triển.'
WHERE stage = 'infant_3_6m' AND title ILIKE '%6-month pediatrician%';

UPDATE care_checklist_templates SET
  title_es = 'Continuar tiempo boca abajo diariamente',
  title_vi = 'Tiếp tục tập nằm sấp hàng ngày',
  description_es = 'Aumenta a 20-30 minutos por día a medida que el bebé se fortalece.',
  description_vi = 'Tăng lên 20-30 phút mỗi ngày khi bé khỏe hơn.'
WHERE stage = 'infant_3_6m' AND title ILIKE '%Continue daily tummy%';

UPDATE care_checklist_templates SET
  title_es = 'Observar hito de darse vuelta',
  title_vi = 'Theo dõi cột mốc lật người',
  description_es = 'La mayoría de los bebés ruedan de frente a espalda alrededor de los 4-5 meses.',
  description_vi = 'Hầu hết trẻ lật từ bụng sang lưng khoảng 4-5 tháng.'
WHERE stage = 'infant_3_6m' AND title ILIKE '%rolling over%';

UPDATE care_checklist_templates SET
  title_es = 'Verificar preparación para introducir sólidos',
  title_vi = 'Kiểm tra sẵn sàng ăn dặm',
  description_es = 'El bebé puede sentarse con apoyo y muestra interés en la comida alrededor de los 4-6 meses.',
  description_vi = 'Bé có thể ngồi với sự hỗ trợ và thể hiện sự quan tâm đến thức ăn khoảng 4-6 tháng.'
WHERE stage = 'infant_3_6m' AND title ILIKE '%Introduce solid foods readiness%';

UPDATE care_checklist_templates SET
  title_es = 'Verificar instalación correcta de silla de auto',
  title_vi = 'Đảm bảo ghế ô tô được lắp đặt đúng cách',
  description_es = 'Orientada hacia atrás hasta al menos los 2 años. Verifica si hay retiros del mercado.',
  description_vi = 'Quay mặt về phía sau cho đến ít nhất 2 tuổi. Kiểm tra thu hồi sản phẩm.'
WHERE stage = 'infant_3_6m' AND title ILIKE '%car seat%correctly%';

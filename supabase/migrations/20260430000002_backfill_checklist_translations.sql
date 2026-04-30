-- Migration: Backfill Spanish & Vietnamese translations for care_checklist_templates
-- Part 1: Expecting Trimesters + Reminders

-- ═══════════════════════════════════════
-- EXPECTING T1 — First Trimester
-- ═══════════════════════════════════════
UPDATE care_checklist_templates SET
  title_es = 'Programar la primera cita prenatal',
  title_vi = 'Đặt lịch khám thai lần đầu',
  description_es = 'Confirma el embarazo y establece la atención prenatal con tu obstetra o partera.',
  description_vi = 'Xác nhận mang thai và bắt đầu chăm sóc thai kỳ với bác sĩ sản khoa.'
WHERE stage = 'expecting_t1' AND title ILIKE '%first prenatal%';

UPDATE care_checklist_templates SET
  title_es = 'Comenzar vitaminas prenatales',
  title_vi = 'Bắt đầu uống vitamin trước sinh',
  description_es = 'Comienza a tomar ácido fólico y vitaminas prenatales diariamente según lo recomendado.',
  description_vi = 'Bắt đầu uống axit folic và vitamin hàng ngày theo khuyến nghị của bác sĩ.'
WHERE stage = 'expecting_t1' AND title ILIKE '%prenatal vitamins%';

UPDATE care_checklist_templates SET
  title_es = 'Programar ecografía NT (11-13 semanas)',
  title_vi = 'Đặt lịch siêu âm NT (tuần 11-13)',
  description_es = 'Examen de translucencia nucal para evaluar el desarrollo temprano.',
  description_vi = 'Sàng lọc độ mờ da gáy để đánh giá sự phát triển sớm.'
WHERE stage = 'expecting_t1' AND title ILIKE '%NT scan%';

UPDATE care_checklist_templates SET
  title_es = 'Investigar clases de preparación para el parto',
  title_vi = 'Tìm hiểu các lớp học sinh nở',
  description_es = 'Busca programas de educación para el parto locales o en línea.',
  description_vi = 'Tìm các chương trình giáo dục sinh nở trực tiếp hoặc trực tuyến.'
WHERE stage = 'expecting_t1' AND title ILIKE '%childbirth classes%' AND stage = 'expecting_t1';

UPDATE care_checklist_templates SET
  title_es = 'Programar examen genético/cromosómico',
  title_vi = 'Đặt lịch xét nghiệm di truyền/nhiễm sắc thể',
  description_es = 'NIPT o ecografía de translucencia nucal generalmente entre las semanas 10-13.',
  description_vi = 'Xét nghiệm NIPT hoặc siêu âm độ mờ da gáy thường vào tuần 10-13.'
WHERE stage = 'expecting_t1' AND title ILIKE '%genetic%';

UPDATE care_checklist_templates SET
  title_es = 'Evitar alcohol, tabaco y alimentos crudos',
  title_vi = 'Tránh rượu, thuốc lá và thực phẩm sống',
  description_es = 'Consulta todos los medicamentos y suplementos con tu médico.',
  description_vi = 'Thảo luận tất cả thuốc và thực phẩm bổ sung với bác sĩ.'
WHERE stage = 'expecting_t1' AND title ILIKE '%alcohol%';

-- ═══════════════════════════════════════
-- EXPECTING T2 — Second Trimester
-- ═══════════════════════════════════════
UPDATE care_checklist_templates SET
  title_es = 'Programar ecografía anatómica (18-20 semanas)',
  title_vi = 'Đặt lịch siêu âm hình thái (tuần 18-20)',
  description_es = 'Ecografía completa para verificar el desarrollo y la anatomía del bebé.',
  description_vi = 'Siêu âm toàn diện để kiểm tra sự phát triển và giải phẫu của bé.'
WHERE stage = 'expecting_t2' AND title ILIKE '%anatomy%';

UPDATE care_checklist_templates SET
  title_es = 'Comenzar un plan de parto',
  title_vi = 'Bắt đầu lập kế hoạch sinh',
  description_es = 'Discute tus preferencias para el trabajo de parto y cuidado postparto con tu médico.',
  description_vi = 'Thảo luận mong muốn về chuyển dạ, sinh nở và chăm sóc sau sinh với bác sĩ.'
WHERE stage = 'expecting_t2' AND title ILIKE '%birth plan%' AND stage = 'expecting_t2';

UPDATE care_checklist_templates SET
  title_es = 'Inscribirse en clases de preparación para el parto',
  title_vi = 'Đăng ký lớp học sinh nở',
  description_es = 'Inscríbete en un curso para aprender técnicas de respiración y cuidado del recién nacido.',
  description_vi = 'Đăng ký khóa học về kỹ thuật thở, các giai đoạn chuyển dạ và chăm sóc trẻ sơ sinh.'
WHERE stage = 'expecting_t2' AND title ILIKE '%Register for childbirth%';

UPDATE care_checklist_templates SET
  title_es = 'Comenzar a planificar la habitación del bebé',
  title_vi = 'Bắt đầu chuẩn bị phòng cho bé',
  description_es = 'Empieza a preparar la habitación del bebé — cuna, cambiador y elementos esenciales.',
  description_vi = 'Bắt đầu chuẩn bị phòng cho bé — nôi, bàn thay tã và các vật dụng cần thiết.'
WHERE stage = 'expecting_t2' AND title ILIKE '%nursery%';

UPDATE care_checklist_templates SET
  title_es = 'Completar la prueba de glucosa',
  title_vi = 'Hoàn thành xét nghiệm glucose',
  description_es = 'Prueba de diabetes gestacional generalmente entre las semanas 24-28.',
  description_vi = 'Sàng lọc tiểu đường thai kỳ thường vào tuần 24-28.'
WHERE stage = 'expecting_t2' AND title ILIKE '%glucose%';

UPDATE care_checklist_templates SET
  title_es = 'Investigar clases de preparación para el parto',
  title_vi = 'Tìm hiểu các lớp học sinh nở',
  description_es = 'Lamaze, Bradley o clases específicas del hospital.',
  description_vi = 'Lamaze, Bradley hoặc các lớp học tại bệnh viện.'
WHERE stage = 'expecting_t2' AND title ILIKE '%Research childbirth%';

UPDATE care_checklist_templates SET
  title_es = 'Comenzar a planificar tus preferencias de parto',
  title_vi = 'Bắt đầu lên kế hoạch cho sở thích sinh nở',
  description_es = 'Considera tus preferencias para el trabajo de parto, manejo del dolor y el parto.',
  description_vi = 'Xem xét sở thích của bạn về chuyển dạ, quản lý đau và sinh nở.'
WHERE stage = 'expecting_t2' AND title ILIKE '%birth preferences%';

-- ═══════════════════════════════════════
-- EXPECTING T3 — Third Trimester
-- ═══════════════════════════════════════
UPDATE care_checklist_templates SET
  title_es = 'Preparar la maleta del hospital',
  title_vi = 'Chuẩn bị túi đồ đi bệnh viện',
  description_es = 'Prepara lo esencial para mamá, pareja y bebé para la estancia en el hospital.',
  description_vi = 'Chuẩn bị đồ cần thiết cho mẹ, người đồng hành và bé cho thời gian ở bệnh viện.'
WHERE stage = 'expecting_t3' AND title ILIKE '%hospital bag%';

UPDATE care_checklist_templates SET
  title_es = 'Instalar la silla de auto',
  title_vi = 'Lắp đặt ghế ô tô cho bé',
  description_es = 'Instala y verifica la silla de auto antes de la fecha de parto.',
  description_vi = 'Lắp đặt và kiểm tra ghế ô tô trước ngày dự sinh.'
WHERE stage = 'expecting_t3' AND title ILIKE '%car seat%';

UPDATE care_checklist_templates SET
  title_es = 'Visitar el hospital o centro de parto',
  title_vi = 'Tham quan bệnh viện hoặc trung tâm sinh',
  description_es = 'Familiarízate con las instalaciones de parto y haz la preinscripción.',
  description_vi = 'Làm quen với cơ sở sinh nở và đăng ký trước.'
WHERE stage = 'expecting_t3' AND title ILIKE '%Tour hospital%';

UPDATE care_checklist_templates SET
  title_es = 'Finalizar la selección del pediatra',
  title_vi = 'Hoàn tất việc chọn bác sĩ nhi',
  description_es = 'Elige un pediatra para la primera visita de tu recién nacido después del nacimiento.',
  description_vi = 'Chọn bác sĩ nhi cho lần khám đầu tiên của trẻ sơ sinh sau khi sinh.'
WHERE stage = 'expecting_t3' AND title ILIKE '%pediatrician selection%';

UPDATE care_checklist_templates SET
  title_es = 'Preparar plan de recuperación postparto',
  title_vi = 'Chuẩn bị kế hoạch phục hồi sau sinh',
  description_es = 'Abastécete de suministros postparto y organiza ayuda para las primeras semanas.',
  description_vi = 'Chuẩn bị đồ dùng sau sinh và sắp xếp người hỗ trợ cho những tuần đầu tiên.'
WHERE stage = 'expecting_t3' AND title ILIKE '%postpartum recovery%';

UPDATE care_checklist_templates SET
  title_es = 'Programar prueba de Estreptococo Grupo B (semana 36)',
  title_vi = 'Đặt lịch xét nghiệm Liên cầu khuẩn nhóm B (tuần 36)',
  description_es = 'Hisopo vaginal/rectal para detectar la bacteria GBS.',
  description_vi = 'Xét nghiệm âm đạo/trực tràng để kiểm tra vi khuẩn GBS.'
WHERE stage = 'expecting_t3' AND title ILIKE '%Group B Strep%';

UPDATE care_checklist_templates SET
  title_es = 'Elegir un pediatra',
  title_vi = 'Chọn bác sĩ nhi khoa',
  description_es = 'Entrevista y selecciona al médico de tu bebé antes del nacimiento.',
  description_vi = 'Phỏng vấn và chọn bác sĩ cho bé trước khi sinh.'
WHERE stage = 'expecting_t3' AND title ILIKE '%Choose a pediatrician%';

UPDATE care_checklist_templates SET
  title_es = 'Contar los movimientos del bebé diariamente',
  title_vi = 'Đếm cử động của bé hàng ngày',
  description_es = 'Intenta 10 movimientos en 2 horas. Informa cualquier preocupación a tu médico.',
  description_vi = 'Đếm 10 cử động trong 2 giờ. Báo cáo bất kỳ lo ngại nào cho bác sĩ.'
WHERE stage = 'expecting_t3' AND title ILIKE '%kick counts%';

-- ═══════════════════════════════════════
-- REMINDER TEMPLATES
-- ═══════════════════════════════════════
UPDATE care_checklist_templates SET
  title_es = 'Programa tu primera visita prenatal',
  title_vi = 'Đặt lịch khám thai lần đầu',
  description_es = 'Tu primera cita con el obstetra establece la fecha de parto, análisis iniciales y plan de atención prenatal. Llama hoy para reservar.',
  description_vi = 'Lần khám thai đầu tiên xác nhận ngày dự sinh, xét nghiệm cơ bản và kế hoạch chăm sóc thai kỳ. Hãy gọi đặt lịch ngay hôm nay.'
WHERE stage = 'reminder_prenatal_t1';

UPDATE care_checklist_templates SET
  title_es = 'Completa tu plan de parto',
  title_vi = 'Hoàn thành kế hoạch sinh',
  description_es = 'Entre las semanas 24-32 es el momento ideal para discutir tus preferencias de parto, opciones de manejo del dolor y entorno de parto con tu equipo de atención.',
  description_vi = 'Tuần 24-32 là thời điểm lý tưởng để thảo luận về sở thích sinh nở, lựa chọn giảm đau và môi trường sinh với đội ngũ chăm sóc.'
WHERE stage = 'reminder_birth_plan';

UPDATE care_checklist_templates SET
  title_es = 'Llama a tu obstetra dentro de las 48 horas del alta',
  title_vi = 'Gọi cho bác sĩ sản khoa trong 48 giờ sau xuất viện',
  description_es = 'Tu equipo de atención necesita un chequeo rápido después de salir del hospital para monitorear señales de advertencia postparto.',
  description_vi = 'Đội ngũ chăm sóc cần kiểm tra nhanh sau khi xuất viện để theo dõi các dấu hiệu cảnh báo sau sinh.'
WHERE stage = 'reminder_48hr_postdischarge';

UPDATE care_checklist_templates SET
  title_es = 'Programa tu chequeo postparto',
  title_vi = 'Đặt lịch khám sau sinh',
  description_es = 'Reserva tu visita postparto de 3 semanas para revisar recuperación física, salud mental y lactancia.',
  description_vi = 'Đặt lịch khám sau sinh 3 tuần để kiểm tra phục hồi thể chất, sức khỏe tinh thần và cho con bú.'
WHERE stage = 'reminder_3wk_postpartum';

UPDATE care_checklist_templates SET
  title_es = 'Mantén el calendario de visitas al pediatra',
  title_vi = 'Giữ đúng lịch khám bác sĩ nhi',
  description_es = 'Tu bebé debe ver al pediatra al 1 mes, 2 meses, 4 meses, 6 meses y 9 meses. Llama para confirmar tu próxima cita.',
  description_vi = 'Bé cần đi khám bác sĩ nhi lúc 1 tháng, 2 tháng, 4 tháng, 6 tháng và 9 tháng. Gọi để xác nhận cuộc hẹn tiếp theo.'
WHERE stage = 'reminder_pediatrician_schedule';

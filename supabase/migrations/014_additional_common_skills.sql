-- Add more common skills to each existing job-skill category.
insert into public.skills (slug, name, category)
values
  ('budget-tracking', 'Budget tracking', 'Administration & Finance'),
  ('expense-tracking', 'Expense tracking', 'Administration & Finance'),
  ('purchase-order-processing', 'Purchase order processing', 'Administration & Finance'),
  ('bank-reconciliation', 'Bank reconciliation', 'Administration & Finance'),
  ('office-supply-management', 'Office supply management', 'Administration & Finance'),
  ('travel-arrangements', 'Travel arrangements', 'Administration & Finance'),
  ('tax-document-preparation', 'Tax document preparation', 'Administration & Finance'),
  ('report-writing', 'Report writing', 'Communication & Collaboration'),
  ('telephone-communication', 'Telephone communication', 'Communication & Collaboration'),
  ('meeting-facilitation', 'Meeting facilitation', 'Communication & Collaboration'),
  ('negotiation', 'Negotiation', 'Communication & Collaboration'),
  ('feedback-skills', 'Giving and receiving feedback', 'Communication & Collaboration'),
  ('cross-cultural-communication', 'Cross-cultural communication', 'Communication & Collaboration'),
  ('professional-communication', 'Professional communication', 'Communication & Collaboration'),
  ('complaint-resolution', 'Complaint resolution', 'Customer Service & Sales'),
  ('call-center-support', 'Call center support', 'Customer Service & Sales'),
  ('appointment-setting', 'Appointment setting', 'Customer Service & Sales'),
  ('customer-retention', 'Customer retention', 'Customer Service & Sales'),
  ('merchandising', 'Merchandising', 'Customer Service & Sales'),
  ('returns-processing', 'Returns and exchange processing', 'Customer Service & Sales'),
  ('lead-generation', 'Lead generation', 'Customer Service & Sales'),
  ('microsoft-office', 'Microsoft Office', 'Digital & Technology'),
  ('google-workspace', 'Google Workspace', 'Digital & Technology'),
  ('presentation-software', 'Presentation software', 'Digital & Technology'),
  ('file-management', 'File management', 'Digital & Technology'),
  ('website-content-management', 'Website content management', 'Digital & Technology'),
  ('basic-programming', 'Basic programming', 'Digital & Technology'),
  ('cybersecurity-awareness', 'Cybersecurity awareness', 'Digital & Technology'),
  ('accessibility-testing', 'Accessibility testing', 'Digital & Technology'),
  ('illustration', 'Illustration', 'Creative & Media'),
  ('brand-design', 'Brand design', 'Creative & Media'),
  ('layout-design', 'Layout design', 'Creative & Media'),
  ('ux-ui-design', 'UX and UI design', 'Creative & Media'),
  ('audio-editing', 'Audio editing', 'Creative & Media'),
  ('content-planning', 'Content planning', 'Creative & Media'),
  ('digital-publishing', 'Digital publishing', 'Creative & Media'),
  ('campaign-design', 'Campaign design', 'Creative & Media'),
  ('route-planning', 'Route planning', 'Operations & Logistics'),
  ('dispatch-coordination', 'Dispatch coordination', 'Operations & Logistics'),
  ('stocktaking', 'Stocktaking', 'Operations & Logistics'),
  ('order-fulfillment', 'Order fulfillment', 'Operations & Logistics'),
  ('packaging', 'Packaging', 'Operations & Logistics'),
  ('production-assembly', 'Production assembly', 'Operations & Logistics'),
  ('quality-assurance', 'Quality assurance', 'Operations & Logistics'),
  ('maintenance-planning', 'Maintenance planning', 'Operations & Logistics'),
  ('supply-chain-coordination', 'Supply-chain coordination', 'Operations & Logistics'),
  ('table-service', 'Table service', 'Hospitality & Food Service'),
  ('catering-support', 'Catering support', 'Hospitality & Food Service'),
  ('reservation-management', 'Reservation management', 'Hospitality & Food Service'),
  ('laundry-services', 'Laundry services', 'Hospitality & Food Service'),
  ('lodging-operations', 'Lodging operations', 'Hospitality & Food Service'),
  ('kitchen-operations', 'Kitchen operations', 'Hospitality & Food Service'),
  ('food-sanitation', 'Food sanitation', 'Hospitality & Food Service'),
  ('room-attendant-service', 'Room attendant service', 'Hospitality & Food Service'),
  ('literacy-support', 'Literacy support', 'Education & Care'),
  ('adult-education', 'Adult education', 'Education & Care'),
  ('learning-support', 'Learning support', 'Education & Care'),
  ('elder-care', 'Elder care', 'Education & Care'),
  ('community-outreach', 'Community outreach', 'Education & Care'),
  ('patient-record-management', 'Patient record management', 'Education & Care'),
  ('first-aid-basics', 'Basic first aid', 'Education & Care'),
  ('special-needs-support', 'Individual learning support', 'Education & Care'),
  ('punctuality', 'Punctuality', 'Workplace Essentials'),
  ('prioritization', 'Prioritization', 'Workplace Essentials'),
  ('decision-making', 'Decision making', 'Workplace Essentials'),
  ('leadership', 'Leadership', 'Workplace Essentials'),
  ('professionalism', 'Professionalism', 'Workplace Essentials'),
  ('confidentiality', 'Confidentiality', 'Workplace Essentials'),
  ('initiative', 'Initiative', 'Workplace Essentials'),
  ('goal-setting', 'Goal setting', 'Workplace Essentials'),
  ('workplace-etiquette', 'Workplace etiquette', 'Workplace Essentials'),
  ('self-motivation', 'Self-motivation', 'Workplace Essentials')
on conflict (slug) do update
set category = excluded.category,
    is_active = true;

-- Keep the catalog aligned with the six categories shown in the skills picker.
update public.skills
set category = case category
  when 'Administration & Finance' then 'Business'
  when 'Communication & Collaboration' then 'People'
  when 'Creative & Media' then 'Creative'
  when 'Customer Service & Sales' then 'People'
  when 'Digital & Technology' then 'Digital work'
  when 'Education & Care' then 'People'
  when 'Hospitality & Food Service' then 'People'
  when 'Operations & Logistics' then 'Business'
  when 'Workplace Essentials' then 'Thinking'
  else category
end
where category in (
  'Administration & Finance',
  'Communication & Collaboration',
  'Creative & Media',
  'Customer Service & Sales',
  'Digital & Technology',
  'Education & Care',
  'Hospitality & Food Service',
  'Operations & Logistics',
  'Workplace Essentials'
);

update public.skills set category = 'Digital work'
where slug = 'social-media';

update public.skills set category = 'Technology'
where slug in ('web-development', 'it-troubleshooting', 'database-management', 'basic-programming', 'accessibility-testing', 'equipment-operation');

update public.skills set category = 'Thinking'
where slug in ('research', 'data-analysis', 'critical-thinking', 'attention-to-detail', 'problem-solving', 'quality-control', 'quality-assurance', 'decision-making', 'prioritization', 'safety-awareness');

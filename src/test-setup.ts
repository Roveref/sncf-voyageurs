// Tell React 19 that the test environment supports act()
// This suppresses the "not configured to support act(...)" warnings in jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import "@testing-library/jest-dom";

// Initialize dynamic config that is normally populated at hydration from var_config
import { applyCategoryConfig, applyGradeConfig } from "./components/StaffingTab/constants";
import { updateSpecialSegmentCodes } from "./utils/constants";

// Special segment codes (derived from var_config.segment where parent != code)
updateSpecialSegmentCodes(["AUTO", "IEM", "LSC"]);

// Default category config for tests (same as init_db.py DEFAULT_VAR_CONFIG.category)
applyCategoryConfig({
  vacation:
    '{"main":"absence","label":"Vacation","bg":"#fef2f2","text":"#dc2626","bar":"#f87171","border":"#fca5a5","jobCodes":["0010","0013","0015","10","15","9999999999"]}',
  rtt: '{"main":"absence","label":"RTT","bg":"#fef2f2","text":"#b91c1c","bar":"#ef4444","border":"#f87171","jobCodes":["F035","F036"]}',
  loa: '{"main":"absence","label":"LOA (Leave of Absence)","bg":"#fff1f2","text":"#e11d48","bar":"#fb7185","border":"#fda4af","jobCodes":["9999999910","9999999911","F016","F600","F605","F613","F631"]}',
  illness:
    '{"main":"absence","label":"Sick Leave","bg":"#fff1f2","text":"#be123c","bar":"#f43f5e","border":"#fb7185","jobCodes":["0200","F056","F210"]}',
  otherAbsence:
    '{"main":"absence","label":"Other Absences","bg":"#fef2f2","text":"#b91c1c","bar":"#fca5a5","border":"#fecaca","jobCodes":["0012","0024","F010","F014","F015","F030","F032","F033","F045","F205"]}',
  holiday:
    '{"main":"absence","label":"Public Holiday","bg":"#fef2f2","text":"#991b1b","bar":"#dc2626","border":"#ef4444"}',
  chargeable:
    '{"main":"chargeable","label":"Chargeable","bg":"#eff6ff","text":"#1d4ed8","bar":"#60a5fa","border":"#93c5fd","routeCodes":["0800"]}',
  generalOppty:
    '{"main":"chargeable","label":"General Oppty Code","bg":"#ecfeff","text":"#0e7490","bar":"#22d3ee","border":"#67e8f9"}',
  pending:
    '{"main":"chargeable","label":"Pending jobcode","bg":"#fefce8","text":"#a16207","bar":"#facc15","border":"#fde047","jobCodes":["7777777777"]}',
  overtime:
    '{"main":"chargeable","label":"Overtime","bg":"#eef2ff","text":"#4f46e5","bar":"#a5b4fc","border":"#c7d2fe","jobCodes":["F810"]}',
  travel:
    '{"main":"nonChargeable","label":"Travel","bg":"#f0f9ff","text":"#0284c7","bar":"#7dd3fc","border":"#bae6fd","jobCodes":["F816"]}',
  travelWe:
    '{"main":"nonChargeable","label":"Travel WE","bg":"#f0f9ff","text":"#64748b","bar":"#94a3b8","border":"#cbd5e1","jobCodes":["F817"]}',
  training:
    '{"main":"training","label":"Training","bg":"#ecfdf5","text":"#047857","bar":"#34d399","border":"#6ee7b7","jobCodes":["0049","9999999980"]}',
  reservation:
    '{"main":"reservation","label":"Reservation w/o jobcode","bg":"#fffbeb","text":"#b45309","bar":"#fbbf24","border":"#fcd34d","jobCodes":["9999999996"]}',
  meeting:
    '{"main":"nonChargeable","label":"Team Meeting","bg":"#f8fafc","text":"#475569","bar":"#94a3b8","border":"#cbd5e1","jobCodes":["0061"]}',
  event:
    '{"main":"nonChargeable","label":"Event / Forum","bg":"#fafafa","text":"#52525b","bar":"#a1a1aa","border":"#d4d4d8","jobCodes":["0062","0092","0093"]}',
  admin:
    '{"main":"nonChargeable","label":"Administration","bg":"#fafaf9","text":"#57534e","bar":"#a8a29e","border":"#d6d3d1","jobCodes":["0077"]}',
  corporate:
    '{"main":"nonChargeable","label":"Corporate / Union","bg":"#fafafa","text":"#525252","bar":"#a3a3a3","border":"#d4d4d4","jobCodes":["0080"]}',
  community:
    '{"main":"nonChargeable","label":"Communities","bg":"#ecfdf5","text":"#059669","bar":"#6ee7b7","border":"#a7f3d0","jobCodes":["0081"]}',
  businessDev:
    '{"main":"nonChargeable","label":"Business Dev / Proposals","bg":"#f7fee7","text":"#4d7c0f","bar":"#a3e635","border":"#bef264","jobCodes":["0083"]}',
  other: '{"main":"nonChargeable","label":"Other","bg":"#f9fafb","text":"#4b5563","bar":"#9ca3af","border":"#d1d5db"}',
  unknown:
    '{"main":"nonChargeable","label":"Unknown","bg":"#f9fafb","text":"#6b7280","bar":"#d1d5db","border":"#e5e7eb"}',
});

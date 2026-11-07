// 연구 운영 설정. null/false인 항목은 아직 확정되지 않은 값이다.
// NODE_ENV=production 이면 미확정 항목이 하나라도 남아 있을 때 신규 가입을 막는다.
export const study = {
  name: 'without counting sheep; for your stable health',
  consentVersion: '2026-11-07-draft5-cloud',
  retentionEnd: '2026년 12월 28일',
  researcher: { email: '시연판 비공개', phone: '시연판 비공개' },
  storageNotice: 'Supabase, Inc.가 운영하는 저장소의 서울 지역 서버에 저장합니다. 연구자만 비밀번호로 보호된 관리 화면에서 볼 수 있습니다. 위탁·국외 이전 해당 여부는 확인 중입니다.',

  reward: null, // 참여 보상
  injuryCompensation: null, // 피해 보상 방법(IRB 규정)
  irbContact: null, // IRB·참여자 권리 문의처
  withdrawalDataPolicy: null, // '삭제합니다' 또는 '식별 정보를 제거한 뒤 분석에 사용합니다'
  sleepRiskWording: null, // 수면 시간 조절 위험 문구(근거 자료와 함께 확정)
  anthropicRetention: null, // Anthropic의 데이터 보유 기간(약관 확인 후 기재)
  transferLegalBasisConfirmed: false, // 위탁/제3자 제공/국외 이전 분류를 IRB·전문가가 확인했는가
  isiLicenseConfirmed: false, // ISI, PSQI, FIRST 저작권자 허가 및 공식 한국어판 문항 반영 여부
  safetyItemsConfirmed: false, // 안전 문진 항목 확정 여부
  sleepFloorConfirmed: false, // 수면 시간 하한(rules.js SLEEP_FLOOR_MIN)의 근거 확인 여부
  hostingInKoreaConfirmed: false, // 국내 서버 호스팅과 위탁 해당 여부, 서버 IP 기록 여부 확인
  notificationVendorsConfirmed: false, // 메일·푸시 발송 서비스의 위탁/국외 이전 해당 여부 확인
};

const LABELS = {
  reward: '참여 보상',
  injuryCompensation: '피해 보상 방법',
  irbContact: 'IRB 문의처',
  withdrawalDataPolicy: '철회 후 자료 처리 방식',
  sleepRiskWording: '수면 시간 조절 위험 문구',
  anthropicRetention: 'Anthropic 데이터 보유 기간',
  transferLegalBasisConfirmed: '국외 이전 법적 분류 확인',
  isiLicenseConfirmed: 'ISI, PSQI, FIRST 사용 허가와 공식 문항',
  safetyItemsConfirmed: '안전 문진 항목 확정',
  sleepFloorConfirmed: '수면 시간 하한 근거 확인',
  hostingInKoreaConfirmed: '호스팅 위치와 IP 기록 확인',
  notificationVendorsConfirmed: '알림 발송 서비스 확인',
};

export function unresolvedItems(config = study) {
  return Object.keys(LABELS)
    .filter((key) => !config[key])
    .map((key) => ({ key, label: LABELS[key] }));
}

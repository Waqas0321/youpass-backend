export type GeneralProducerRow = {
  id: string;
  fullName: string;
  phone: string;
};

export type ProducerRegistrationFormState = {
  ownerFullName: string;
  ownerContactNumber: string;
  legalCompanyName: string;
  logoFileName: string | null;
  officialEmail: string;
  generalProducers: GeneralProducerRow[];
};

export const PRODUCER_REGISTRATION_DATE_RANGE = {
  start: '2026-01-25',
  end: '2026-01-31',
};

let rowCounter = 0;

export function createGeneralProducerRow(): GeneralProducerRow {
  rowCounter += 1;
  return {
    id: `producer-${rowCounter}`,
    fullName: '',
    phone: '',
  };
}

export function createInitialRegistrationForm(): ProducerRegistrationFormState {
  return {
    ownerFullName: '',
    ownerContactNumber: '',
    legalCompanyName: '',
    logoFileName: null,
    officialEmail: '',
    generalProducers: [createGeneralProducerRow(), createGeneralProducerRow()],
  };
}

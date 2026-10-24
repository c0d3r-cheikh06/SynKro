export interface CountryDialOption {
  iso: string;
  dialCode: string; // digits without '+', e.g. "221"
  label: string;
  placeholder: string;
  formatHint: string;
  stripTrunkZero?: boolean;
  validateNational: (nationalDigits: string) => boolean;
  errorMessage: string;
}

export const SUPPORTED_COUNTRY_DIAL_CODES: readonly CountryDialOption[] = [
  {
    iso: "SN",
    dialCode: "221",
    label: "Sénégal (+221)",
    placeholder: "77 123 45 67",
    formatHint: "9 chiffres — préfixes 70, 71, 75, 76, 77, 78 ou 33 (ex : 77 123 45 67)",
    stripTrunkZero: false,
    validateNational: (d) => /^(70|71|75|76|77|78|30|32|33)\d{7}$/.test(d),
    errorMessage:
      "Numéro sénégalais invalide : saisissez 9 chiffres commençant par 70, 75, 76, 77, 78 ou 33 (ex : 77 123 45 67).",
  },
  {
    iso: "CI",
    dialCode: "225",
    label: "Côte d'Ivoire (+225)",
    placeholder: "07 12 34 56 78",
    formatHint: "10 chiffres commençant par 01, 05, 07, 21, 25 ou 27",
    stripTrunkZero: false,
    validateNational: (d) => /^(01|05|07|21|25|27)\d{8}$/.test(d),
    errorMessage:
      "Numéro ivoirien invalide : saisissez 10 chiffres commençant par 01, 05, 07, 21, 25 ou 27.",
  },
  {
    iso: "ML",
    dialCode: "223",
    label: "Mali (+223)",
    placeholder: "76 12 34 56",
    formatHint: "8 chiffres (ex : 76 12 34 56)",
    stripTrunkZero: false,
    validateNational: (d) => /^[2456789]\d{7}$/.test(d),
    errorMessage: "Numéro malien invalide : saisissez 8 chiffres valides.",
  },
  {
    iso: "GN",
    dialCode: "224",
    label: "Guinée (+224)",
    placeholder: "622 12 34 56",
    formatHint: "9 chiffres commençant par 6 (ex : 622 12 34 56)",
    stripTrunkZero: false,
    validateNational: (d) => /^6\d{8}$/.test(d),
    errorMessage:
      "Numéro guinéen invalide : saisissez 9 chiffres commençant par 6.",
  },
  {
    iso: "MR",
    dialCode: "222",
    label: "Mauritanie (+222)",
    placeholder: "46 12 34 56",
    formatHint: "8 chiffres commençant par 2, 3 ou 4",
    stripTrunkZero: false,
    validateNational: (d) => /^[234]\d{7}$/.test(d),
    errorMessage:
      "Numéro mauritanien invalide : saisissez 8 chiffres commençant par 2, 3 ou 4.",
  },
  {
    iso: "BF",
    dialCode: "226",
    label: "Burkina Faso (+226)",
    placeholder: "70 12 34 56",
    formatHint: "8 chiffres (ex : 70 12 34 56)",
    stripTrunkZero: false,
    validateNational: (d) => /^[02567]\d{7}$/.test(d),
    errorMessage: "Numéro burkinabè invalide : saisissez 8 chiffres valides.",
  },
  {
    iso: "TG",
    dialCode: "228",
    label: "Togo (+228)",
    placeholder: "90 12 34 56",
    formatHint: "8 chiffres commençant par 2, 7 ou 9",
    stripTrunkZero: false,
    validateNational: (d) => /^[279]\d{7}$/.test(d),
    errorMessage: "Numéro togolais invalide : saisissez 8 chiffres valides.",
  },
  {
    iso: "BJ",
    dialCode: "229",
    label: "Bénin (+229)",
    placeholder: "01 97 12 34 56",
    formatHint: "10 chiffres (01...) ou 8 chiffres",
    stripTrunkZero: false,
    validateNational: (d) => /^(01\d{8}|[45689]\d{7})$/.test(d),
    errorMessage: "Numéro béninois invalide : saisissez 8 ou 10 chiffres valides.",
  },
  {
    iso: "NE",
    dialCode: "227",
    label: "Niger (+227)",
    placeholder: "96 12 34 56",
    formatHint: "8 chiffres commençant par 2, 7, 8 ou 9",
    stripTrunkZero: false,
    validateNational: (d) => /^[2789]\d{7}$/.test(d),
    errorMessage: "Numéro nigérien invalide : saisissez 8 chiffres valides.",
  },
  {
    iso: "CM",
    dialCode: "237",
    label: "Cameroun (+237)",
    placeholder: "6 77 12 34 56",
    formatHint: "9 chiffres commençant par 6 ou 2",
    stripTrunkZero: false,
    validateNational: (d) => /^[26]\d{8}$/.test(d),
    errorMessage:
      "Numéro camerounais invalide : saisissez 9 chiffres commençant par 6 ou 2.",
  },
  {
    iso: "GA",
    dialCode: "241",
    label: "Gabon (+241)",
    placeholder: "77 12 34 56",
    formatHint: "8 chiffres (ex : 77 12 34 56)",
    stripTrunkZero: true,
    validateNational: (d) => /^[1-7]\d{6,7}$/.test(d),
    errorMessage: "Numéro gabonais invalide : saisissez 7 ou 8 chiffres valides.",
  },
  {
    iso: "MA",
    dialCode: "212",
    label: "Maroc (+212)",
    placeholder: "6 12 34 56 78",
    formatHint: "9 chiffres commençant par 5, 6 ou 7 (ex : 6 12 34 56 78)",
    stripTrunkZero: true,
    validateNational: (d) => /^[567]\d{8}$/.test(d),
    errorMessage:
      "Numéro marocain invalide : saisissez 9 chiffres commençant par 5, 6 ou 7.",
  },
  {
    iso: "FR",
    dialCode: "33",
    label: "France (+33)",
    placeholder: "6 12 34 56 78",
    formatHint: "9 chiffres sans le 0 initial (ou 10 avec le 0, ex : 06 12 34 56 78)",
    stripTrunkZero: true,
    validateNational: (d) => /^[1-9]\d{8}$/.test(d),
    errorMessage:
      "Numéro français invalide : saisissez un numéro à 9 chiffres (ex : 6 12 34 56 78 ou 06 12 34 56 78).",
  },
  {
    iso: "CA",
    dialCode: "1",
    label: "Canada / États-Unis (+1)",
    placeholder: "514 234 5678",
    formatHint: "10 chiffres (ex : 514 234 5678)",
    stripTrunkZero: false,
    validateNational: (d) => /^[2-9]\d{2}[2-9]\d{6}$/.test(d),
    errorMessage:
      "Numéro nord-américain (+1) invalide : saisissez 10 chiffres valides (ex : 514 234 5678).",
  },
] as const;

const SORTED_DIAL_OPTIONS = [...SUPPORTED_COUNTRY_DIAL_CODES].sort(
  (a, b) => b.dialCode.length - a.dialCode.length
);

function hasAllIdenticalDigits(digits: string): boolean {
  return digits.length >= 6 && /^(\d)\1+$/.test(digits);
}

function validateFullE164Digits(allDigits: string): string | null {
  if (!/^[1-9]\d{7,14}$/.test(allDigits)) {
    return null;
  }

  const matchedCountry = SORTED_DIAL_OPTIONS.find((opt) =>
    allDigits.startsWith(opt.dialCode)
  );

  if (matchedCountry) {
    let national = allDigits.slice(matchedCountry.dialCode.length);
    if (matchedCountry.stripTrunkZero && national.startsWith("0")) {
      national = national.slice(1);
    }
    if (hasAllIdenticalDigits(national)) {
      return null;
    }
    if (!matchedCountry.validateNational(national)) {
      return null;
    }
    return `+${matchedCountry.dialCode}${national}`;
  }

  // Generic international E.164 fallback for countries not in quick-list:
  // require 9-15 digits total and forbid repeating identical subscriber digits
  if (allDigits.length < 9 || allDigits.length > 15) {
    return null;
  }
  if (hasAllIdenticalDigits(allDigits.slice(2))) {
    return null;
  }
  return `+${allDigits}`;
}

/**
 * Normalizes and strictly validates a phone number into E.164 format (e.g. +221771234567).
 * Rejects numbers with letters, invalid country plans, wrong lengths, or repeated dummy digits.
 */
export function normalizePhoneNumber(
  input: string | null | undefined,
  defaultCountryCode = "221"
): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Reject alphabetic or unexpected characters (only digits, +, spaces, hyphens, dots, parentheses)
  if (!/^[+\d\s\-().]+$/.test(trimmed)) {
    return null;
  }

  let cleaned = trimmed.replace(/[\s\-().]/g, "");
  if (!cleaned) return null;

  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1);
    if (!/^\d+$/.test(digits)) return null;
    return validateFullE164Digits(digits);
  }

  if (!/^\d+$/.test(cleaned)) {
    return null;
  }

  // Senegalese local mobile/landline format: 9 digits starting with valid SN prefix
  if (
    cleaned.length === 9 &&
    /^(70|71|75|76|77|78|30|32|33)\d{7}$/.test(cleaned)
  ) {
    if (hasAllIdenticalDigits(cleaned)) return null;
    return `+221${cleaned}`;
  }

  // French local format: 10 digits starting with 06 or 07 (or 01-09)
  if (cleaned.length === 10 && /^0[1-9]\d{8}$/.test(cleaned) && defaultCountryCode === "33") {
    const nat = cleaned.slice(1);
    if (hasAllIdenticalDigits(nat)) return null;
    return `+33${nat}`;
  }
  if (cleaned.length === 10 && /^0[67]\d{8}$/.test(cleaned)) {
    const nat = cleaned.slice(1);
    if (hasAllIdenticalDigits(nat)) return null;
    return `+33${nat}`;
  }

  // Already includes a known international country code without '+'
  if (cleaned.length >= 11 && cleaned.length <= 15) {
    return validateFullE164Digits(cleaned);
  }

  // Validate against the provided defaultCountryCode
  const cleanDial = defaultCountryCode.replace(/\D/g, "") || "221";
  return validateFullE164Digits(`${cleanDial}${cleaned}`);
}

/**
 * Validates and normalizes a phone number entered alongside an explicit country dial code
 * (e.g. dialCode = "+221" or "221", rawPhone = "77 123 45 67").
 */
export function validateAndNormalizePhoneWithCountry(
  dialCodeInput: string,
  rawPhoneInput: string
):
  | { valid: true; e164: string; formatted: string }
  | { valid: false; error: string } {
  const cleanDial = dialCodeInput.replace(/\D/g, "");
  const countryOption = SUPPORTED_COUNTRY_DIAL_CODES.find(
    (c) => c.dialCode === cleanDial
  );

  if (!cleanDial || !/^[1-9]\d{0,3}$/.test(cleanDial)) {
    return {
      valid: false,
      error: "Veuillez sélectionner un indicatif de pays valide (ex : +221).",
    };
  }

  const trimmed = rawPhoneInput.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: "Veuillez saisir votre numéro de téléphone WhatsApp.",
    };
  }

  if (!/^[+\d\s\-().]+$/.test(trimmed)) {
    return {
      valid: false,
      error:
        "Le numéro ne doit contenir que des chiffres et espaces (aucune lettre).",
    };
  }

  let digits = trimmed.replace(/[\s\-().]/g, "");
  if (digits.startsWith("00")) {
    digits = "+" + digits.slice(2);
  }

  // If the user pasted the full +<country> prefix into the phone field as well, handle gracefully
  if (digits.startsWith(`+${cleanDial}`)) {
    digits = digits.slice(cleanDial.length + 1);
  } else if (digits.startsWith("+")) {
    const normalizedDirect = normalizePhoneNumber(digits, cleanDial);
    if (!normalizedDirect) {
      return {
        valid: false,
        error:
          countryOption?.errorMessage ??
          "Ce numéro international est invalide. Vérifiez l'indicatif et le nombre de chiffres.",
      };
    }
    return {
      valid: true,
      e164: normalizedDirect,
      formatted: formatPhoneDisplay(normalizedDirect),
    };
  } else if (
    digits.startsWith(cleanDial) &&
    digits.length > (cleanDial === "221" ? 9 : 8)
  ) {
    digits = digits.slice(cleanDial.length);
  }

  if (!/^\d+$/.test(digits)) {
    return {
      valid: false,
      error: "Format de numéro invalide.",
    };
  }

  if (countryOption) {
    const national =
      countryOption.stripTrunkZero && digits.startsWith("0")
        ? digits.slice(1)
        : digits;

    if (hasAllIdenticalDigits(national) || !countryOption.validateNational(national)) {
      return {
        valid: false,
        error: countryOption.errorMessage,
      };
    }

    const e164 = `+${countryOption.dialCode}${national}`;
    return {
      valid: true,
      e164,
      formatted: formatPhoneDisplay(e164),
    };
  }

  const generic = validateFullE164Digits(`${cleanDial}${digits}`);
  if (!generic) {
    return {
      valid: false,
      error:
        "Ce numéro de téléphone est invalide pour l'indicatif sélectionné.",
    };
  }

  return {
    valid: true,
    e164: generic,
    formatted: formatPhoneDisplay(generic),
  };
}

/**
 * Generates a safe WhatsApp click-to-chat URL (`https://wa.me/<digits>?text=...`)
 * from any raw or normalized phone number.
 * Note: Clicking a WhatsApp link only opens the chat window; it never proves a message was sent
 * and NEVER confirms a meeting automatically.
 */
export function buildWhatsAppUrl(
  phone: string | null | undefined,
  prefilledMessage?: string
): string | null {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return null;

  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;

  const baseUrl = `https://wa.me/${digits}`;
  if (!prefilledMessage) return baseUrl;

  return `${baseUrl}?text=${encodeURIComponent(prefilledMessage)}`;
}

export function formatPhoneDisplay(phone: string | null | undefined): string {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return phone || "Non renseigné";

  if (normalized.startsWith("+221") && normalized.length === 13) {
    const local = normalized.slice(4);
    return `+221 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
  }
  if (normalized.startsWith("+33") && normalized.length === 12) {
    const local = normalized.slice(3);
    return `+33 ${local.slice(0, 1)} ${local.slice(1, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
  }
  return normalized;
}

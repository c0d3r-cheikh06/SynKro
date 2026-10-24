import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  generateVerificationToken,
  hashPassword,
  hashToken,
  normalizeEmail,
  verifyPassword,
} from "../crypto";
import {
  buildWhatsAppUrl,
  formatPhoneDisplay,
  normalizePhoneNumber,
} from "../phone";
import { detectImageMimeType, stripJpegApp1Segments } from "../storage";
import { AVATAR_PRESETS, getPortraitUrlBySeed } from "../validation";

describe("Utilitaires de sécurité, téléphone WhatsApp et stockage Synkro", () => {
  it("1. Normalise les numéros sénégalais, français et internationaux en E.164", () => {
    assert.equal(normalizePhoneNumber("77 123 45 67"), "+221771234567");
    assert.equal(normalizePhoneNumber("+221 78-456-78-90"), "+221784567890");
    assert.equal(normalizePhoneNumber("00221761112233"), "+221761112233");
    assert.equal(normalizePhoneNumber("06 12 34 56 78"), "+33612345678");
    assert.equal(normalizePhoneNumber("invalid"), null);
    assert.equal(
      formatPhoneDisplay("771234567"),
      "+221 77 123 45 67"
    );
  });

  it("2. Génère des liens WhatsApp wa.me valides et sécurisés", () => {
    const url = buildWhatsAppUrl(
      "77 123 45 67",
      "Salut ! Nous sommes jumeaux sur Synkro cette semaine."
    );
    assert.ok(url?.startsWith("https://wa.me/221771234567?text="));
    assert.equal(buildWhatsAppUrl(""), null);
  });

  it("3. Hache les mots de passe avec bcrypt et génère des tokens SHA-256 non réversibles", async () => {
    const hash = await hashPassword("SynkroPass2026!");
    assert.notEqual(hash, "SynkroPass2026!");
    assert.equal(await verifyPassword("SynkroPass2026!", hash), true);
    assert.equal(await verifyPassword("WrongPass123", hash), false);

    const { rawToken, tokenHash } = generateVerificationToken();
    assert.equal(rawToken.length, 64);
    assert.equal(tokenHash, hashToken(rawToken));
    assert.notEqual(rawToken, tokenHash);
    assert.equal(normalizeEmail("  Etudiant@Synkro.SN "), "etudiant@synkro.sn");
  });

  it("4. Détecte les magic bytes et supprime les segments EXIF APP1 des JPEG", () => {
    // Minimal synthetic JPEG with an APP1 EXIF segment (0xFFE1)
    const soi = Buffer.from([0xff, 0xd8]);
    const app1Payload = Buffer.from("Exif\0\0SensitiveGPSData", "ascii");
    const app1Len = Buffer.alloc(2);
    app1Len.writeUInt16BE(app1Payload.length + 2, 0);
    const app1 = Buffer.concat([
      Buffer.from([0xff, 0xe1]),
      app1Len,
      app1Payload,
    ]);
    const sosAndRest = Buffer.from([
      0xff, 0xdb, 0x00, 0x04, 0x00, 0x01, 0xff, 0xda, 0x01, 0x02, 0xff, 0xd9,
    ]);
    const jpegWithExif = Buffer.concat([soi, app1, sosAndRest]);

    assert.equal(detectImageMimeType(jpegWithExif), "image/jpeg");
    const stripped = stripJpegApp1Segments(jpegWithExif);
    assert.equal(
      stripped.includes(Buffer.from("SensitiveGPSData", "ascii")),
      false,
      "Les métadonnées EXIF/GPS doivent être purgées"
    );
  });

  it("5. Vérifie l'intégrité des 10 avatars informatiques (Pixel, Kernel, Nova, Cipher, Nexus, Quantum, Vector, Orbit, Syntax, Astro)", () => {
    assert.equal(AVATAR_PRESETS.length, 10);
    const expectedNames = [
      "Pixel",
      "Kernel",
      "Nova",
      "Cipher",
      "Nexus",
      "Quantum",
      "Vector",
      "Orbit",
      "Syntax",
      "Astro",
    ];
    assert.deepEqual(
      AVATAR_PRESETS.map((p) => p.label),
      expectedNames
    );

    for (const preset of AVATAR_PRESETS) {
      const filePath = path.join(process.cwd(), "public", preset.url);
      assert.equal(
        fs.existsSync(filePath),
        true,
        `Le fichier d'avatar ${preset.url} doit exister dans public/`
      );
      const svgContent = fs.readFileSync(filePath, "utf8");
      assert.ok(svgContent.includes("<svg") && svgContent.includes("</svg>"));
    }

    const seededUrl = getPortraitUrlBySeed("etudiant@synkro.app");
    assert.ok(seededUrl.startsWith("/avatars/avatar-"));
  });
});

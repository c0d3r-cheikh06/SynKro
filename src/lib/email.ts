import { EmailStatus, EmailType } from "@prisma/client";
import { prisma } from "./prisma";

export interface SendTransactionalEmailParams {
  userId?: string;
  toEmail: string;
  subject: string;
  type: EmailType;
  html: string;
  text: string;
  /** Optional deduplication window in minutes for the same (toEmail, type, subject) */
  dedupeWindowMinutes?: number;
}

export interface EmailSendResult {
  success: boolean;
  provider: string;
  status: EmailStatus;
  externalId?: string;
  errorMessage?: string;
  devPreview?: {
    to: string;
    subject: string;
    text: string;
  };
}

/**
 * Transactional email service supporting:
 * - RESEND (via official HTTP API https://api.resend.com/emails)
 * - CONSOLE (explicit local development output, clearly marked as dev log)
 *
 * Security rule: Never fake a successful delivery when a production provider is configured
 * without valid credentials or when no provider is configured in production.
 */
export async function sendTransactionalEmail(
  params: SendTransactionalEmailParams
): Promise<EmailSendResult> {
  const provider = (process.env.EMAIL_PROVIDER || "").trim().toUpperCase();
  const from = process.env.EMAIL_FROM || "Synkro <no-reply@synkro.app>";

  // Prevent accidental duplicate emails within the deduplication window
  if (params.dedupeWindowMinutes && params.dedupeWindowMinutes > 0) {
    try {
      const since = new Date(
        Date.now() - params.dedupeWindowMinutes * 60 * 1000
      );
      const recent = await prisma.emailDeliveryAttempt.findFirst({
        where: {
          toEmail: params.toEmail,
          type: params.type,
          subject: params.subject,
          status: EmailStatus.SENT,
          createdAt: { gte: since },
        },
      });
      if (recent) {
        return {
          success: true,
          provider: provider || "NONE",
          status: EmailStatus.SENT,
          externalId: recent.externalId ?? "deduped",
        };
      }
    } catch {
      // Continue if DB is unavailable
    }
  }

  let attemptId: string | null = null;
  try {
    const attempt = await prisma.emailDeliveryAttempt.create({
      data: {
        userId: params.userId ?? null,
        toEmail: params.toEmail,
        subject: params.subject,
        type: params.type,
        status: EmailStatus.PENDING,
        attempts: 1,
      },
    });
    attemptId = attempt.id;
  } catch {
    // Database might not be reachable in offline tests
  }

  const updateAttempt = async (
    status: EmailStatus,
    externalId?: string,
    errorMessage?: string
  ) => {
    if (!attemptId) return;
    try {
      await prisma.emailDeliveryAttempt.update({
        where: { id: attemptId },
        data: {
          status,
          externalId: externalId ?? null,
          errorMessage: errorMessage ?? null,
          sentAt: status === EmailStatus.SENT ? new Date() : null,
          nextRetryAt:
            status === EmailStatus.FAILED
              ? new Date(Date.now() + 15 * 60 * 1000)
              : null,
        },
      });
    } catch {
      // Ignore DB update error
    }
  };

  if (provider === "RESEND") {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      const errMsg =
        "EMAIL_PROVIDER=RESEND mais RESEND_API_KEY est absent. Aucun e-mail n'a été envoyé.";
      await updateAttempt(EmailStatus.FAILED, undefined, errMsg);
      return {
        success: false,
        provider: "RESEND",
        status: EmailStatus.FAILED,
        errorMessage: errMsg,
      };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [params.toEmail],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });

      if (!response.ok) {
        const bodyText = await response.text();
        const errMsg = `Erreur API Resend (${response.status}): ${bodyText.slice(0, 250)}`;
        await updateAttempt(EmailStatus.FAILED, undefined, errMsg);
        return {
          success: false,
          provider: "RESEND",
          status: EmailStatus.FAILED,
          errorMessage: errMsg,
        };
      }

      const data = (await response.json()) as { id?: string };
      await updateAttempt(EmailStatus.SENT, data.id);
      return {
        success: true,
        provider: "RESEND",
        status: EmailStatus.SENT,
        externalId: data.id,
      };
    } catch (error) {
      const errMsg =
        error instanceof Error
          ? error.message
          : "Erreur réseau lors de l'appel à Resend";
      await updateAttempt(EmailStatus.FAILED, undefined, errMsg);
      return {
        success: false,
        provider: "RESEND",
        status: EmailStatus.FAILED,
        errorMessage: errMsg,
      };
    }
  }

  if (provider === "CONSOLE" && process.env.NODE_ENV !== "production") {
    const externalId = `dev-console-${Date.now()}`;
    console.info(
      `\n================ [SYNKRO EMAIL - MODE CONSOLE DEV] ================\n` +
        `À       : ${params.toEmail}\n` +
        `De      : ${from}\n` +
        `Type    : ${params.type}\n` +
        `Sujet   : ${params.subject}\n` +
        `-------------------------------------------------------------------\n` +
        `${params.text}\n` +
        `===================================================================\n`
    );
    await updateAttempt(EmailStatus.SENT, externalId);
    return {
      success: true,
      provider: "CONSOLE",
      status: EmailStatus.SENT,
      externalId,
      devPreview: {
        to: params.toEmail,
        subject: params.subject,
        text: params.text,
      },
    };
  }

  // If no valid provider is configured (or CONSOLE in production), do NOT fake success
  const errMsg = provider
    ? `Fournisseur d'e-mails "${provider}" non configuré ou non autorisé en production.`
    : "Aucun fournisseur d'e-mails transactionnels n'est configuré (EMAIL_PROVIDER manquant).";

  await updateAttempt(EmailStatus.FAILED, undefined, errMsg);
  return {
    success: false,
    provider: provider || "NONE",
    status: EmailStatus.FAILED,
    errorMessage: errMsg,
  };
}

function wrapEmailTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#F7F8FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#172033;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#FFFFFF;border:1px solid #E4E8EF;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#173B67;padding:24px 32px;color:#FFFFFF;">
              <strong style="font-size:20px;letter-spacing:-0.02em;">Synkro</strong>
              <span style="font-size:13px;color:#BFDBFE;margin-left:8px;">Jumelage inter-groupes</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:20px;color:#173B67;">${title}</h1>
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background:#F7F8FA;border-top:1px solid #E4E8EF;font-size:12px;color:#667085;">
              Cet e-mail a été envoyé par Synkro. Vous pouvez gérer vos préférences de notification depuis votre profil étudiant.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(params: {
  userId: string;
  toEmail: string;
  firstName: string;
  rawToken: string;
}): Promise<EmailSendResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(params.rawToken)}`;
  const subject = "Vérifiez votre adresse e-mail — Synkro";
  const text = `Bonjour ${params.firstName},\n\nBienvenue sur Synkro ! Pour confirmer votre adresse e-mail et soumettre votre compte à l'approbation de l'administrateur, cliquez sur le lien suivant :\n${verifyUrl}\n\nCe lien expire dans 24 heures.\n\nL'équipe Synkro`;
  const html = wrapEmailTemplate(
    "Vérifiez votre adresse e-mail",
    `<p style="line-height:1.6;">Bonjour <strong>${params.firstName}</strong>,</p>
     <p style="line-height:1.6;">Bienvenue sur <strong>Synkro</strong> ! Confirmez votre adresse e-mail afin que votre inscription puisse être validée par l'administrateur de la classe :</p>
     <p style="margin:24px 0;">
       <a href="${verifyUrl}" style="display:inline-block;background:#2864E8;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;">Vérifier mon adresse e-mail</a>
     </p>
     <p style="font-size:13px;color:#667085;word-break:break-all;">Lien direct : ${verifyUrl}</p>`
  );

  return sendTransactionalEmail({
    userId: params.userId,
    toEmail: params.toEmail,
    subject,
    type: EmailType.EMAIL_VERIFICATION,
    html,
    text,
    dedupeWindowMinutes: 2,
  });
}

export async function sendPasswordResetEmail(params: {
  userId: string;
  toEmail: string;
  firstName: string;
  rawToken: string;
}): Promise<EmailSendResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(params.rawToken)}`;
  const subject = "Réinitialisation de votre mot de passe — Synkro";
  const text = `Bonjour ${params.firstName},\n\nUne demande de réinitialisation de mot de passe a été effectuée pour votre compte Synkro.\nUtilisez ce lien valable 1 heure :\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`;
  const html = wrapEmailTemplate(
    "Réinitialisation de votre mot de passe",
    `<p style="line-height:1.6;">Bonjour <strong>${params.firstName}</strong>,</p>
     <p style="line-height:1.6;">Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe (lien valable 1 heure) :</p>
     <p style="margin:24px 0;">
       <a href="${resetUrl}" style="display:inline-block;background:#2864E8;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;">Réinitialiser mon mot de passe</a>
     </p>
     <p style="font-size:13px;color:#667085;word-break:break-all;">Lien direct : ${resetUrl}</p>`
  );

  return sendTransactionalEmail({
    userId: params.userId,
    toEmail: params.toEmail,
    subject,
    type: EmailType.PASSWORD_RESET,
    html,
    text,
    dedupeWindowMinutes: 2,
  });
}

export async function sendAccountStatusEmail(params: {
  userId: string;
  toEmail: string;
  firstName: string;
  status: "APPROVED" | "REJECTED" | "SUSPENDED" | "CORRECTION_REQUESTED";
  reason?: string;
}): Promise<EmailSendResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const map = {
    APPROVED: {
      type: EmailType.ACCOUNT_APPROVED,
      subject: "Votre compte Synkro est approuvé !",
      title: "Compte approuvé",
      message:
        "Votre inscription a été validée par l'administrateur. Vous pouvez maintenant accéder à votre espace étudiant et découvrir vos jumeaux hebdomadaires.",
      ctaText: "Accéder à mon tableau de bord",
      ctaUrl: `${appUrl}/dashboard`,
    },
    REJECTED: {
      type: EmailType.ACCOUNT_REJECTED,
      subject: "Statut de votre inscription Synkro",
      title: "Inscription non retenue",
      message: `Votre demande d'inscription n'a pas pu être approuvée.${params.reason ? ` Motif : ${params.reason}` : ""}`,
      ctaText: "Consulter le statut",
      ctaUrl: `${appUrl}/login`,
    },
    SUSPENDED: {
      type: EmailType.ACCOUNT_SUSPENDED,
      subject: "Suspension temporaire de votre compte Synkro",
      title: "Compte suspendu",
      message: `Votre compte a été suspendu par un administrateur.${params.reason ? ` Motif : ${params.reason}` : ""}`,
      ctaText: "Voir les détails",
      ctaUrl: `${appUrl}/login`,
    },
    CORRECTION_REQUESTED: {
      type: EmailType.CORRECTION_REQUESTED,
      subject: "Correction demandée sur votre profil Synkro",
      title: "Correction d'informations requise",
      message: `L'administrateur vous invite à mettre à jour certaines informations avant l'activation de votre compte.${params.reason ? ` Détail : ${params.reason}` : ""}`,
      ctaText: "Mettre à jour mon profil",
      ctaUrl: `${appUrl}/profile`,
    },
  }[params.status];

  const text = `Bonjour ${params.firstName},\n\n${map.message}\n\nLien : ${map.ctaUrl}`;
  const html = wrapEmailTemplate(
    map.title,
    `<p style="line-height:1.6;">Bonjour <strong>${params.firstName}</strong>,</p>
     <p style="line-height:1.6;">${map.message}</p>
     <p style="margin:24px 0;">
       <a href="${map.ctaUrl}" style="display:inline-block;background:#2864E8;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;">${map.ctaText}</a>
     </p>`
  );

  return sendTransactionalEmail({
    userId: params.userId,
    toEmail: params.toEmail,
    subject: map.subject,
    type: map.type,
    html,
    text,
    dedupeWindowMinutes: 5,
  });
}

export async function sendMatchPublishedEmail(params: {
  userId: string;
  toEmail: string;
  firstName: string;
  weekNumber: number;
  cycleName: string;
  partnerNames: string[];
}): Promise<EmailSendResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const subject = `Semaine ${params.weekNumber} (${params.cycleName}) : Vos nouveaux jumeaux Synkro sont disponibles !`;
  const listText = params.partnerNames.map((n) => `- ${n}`).join("\n");
  const listHtml = params.partnerNames
    .map((n) => `<li style="margin-bottom:6px;"><strong>${n}</strong></li>`)
    .join("");

  const text = `Bonjour ${params.firstName},\n\nLes jumelages de la semaine ${params.weekNumber} (${params.cycleName}) sont publiés !\nVos jumeaux cette semaine :\n${listText}\n\nRendez-vous sur ${appUrl}/dashboard pour les contacter sur WhatsApp et confirmer vos rencontres.`;
  const html = wrapEmailTemplate(
    `Semaine ${params.weekNumber} — Vos jumeaux sont prêts !`,
    `<p style="line-height:1.6;">Bonjour <strong>${params.firstName}</strong>,</p>
     <p style="line-height:1.6;">Les jumelages de la <strong>Semaine ${params.weekNumber}</strong> (${params.cycleName}) viennent d'être publiés. Voici vos partenaires de la semaine :</p>
     <ul style="line-height:1.6;padding-left:20px;">${listHtml}</ul>
     <p style="margin:24px 0;">
       <a href="${appUrl}/dashboard" style="display:inline-block;background:#2864E8;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;">Voir mes jumeaux & contacter sur WhatsApp</a>
     </p>`
  );

  return sendTransactionalEmail({
    userId: params.userId,
    toEmail: params.toEmail,
    subject,
    type: EmailType.MATCH_PUBLISHED,
    html,
    text,
    dedupeWindowMinutes: 60,
  });
}

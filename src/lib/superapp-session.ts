import prisma from "@/lib/prisma";
import {
  normalizeEthiopianPhoneStrict,
  normalizePhoneNumber,
} from "@/lib/utils";

const VALIDATE_TOKEN_URL = process.env.VALIDATE_TOKEN_URL;

export type SuperAppSession = {
  userId: string | null;
  phoneNumber: string;
};

function getNormalizedPhoneFromValidation(payload: any) {
  try {
    return normalizeEthiopianPhoneStrict(payload?.phone);
  } catch {
    const normalized = normalizePhoneNumber(payload?.phone);
    if (!normalized) {
      throw new Error("Phone number not found in token validation response.");
    }

    return normalizeEthiopianPhoneStrict(normalized);
  }
}

export async function getSuperAppSessionFromToken(
  superAppToken?: string | null,
): Promise<SuperAppSession | null> {
  if (!superAppToken || !VALIDATE_TOKEN_URL) {
    return null;
  }

  const externalResponse = await fetch(VALIDATE_TOKEN_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${superAppToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const raw = await externalResponse.text();
  let responseData: any = null;

  try {
    responseData = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error("Token validation service returned invalid JSON.");
  }

  if (!externalResponse.ok) {
    if (externalResponse.status === 401 || externalResponse.status === 403) {
      return null;
    }

    const message =
      responseData?.message ||
      `Token validation failed with status ${externalResponse.status}.`;
    throw new Error(message);
  }

  const phoneNumber = getNormalizedPhoneFromValidation(responseData);
  const user = await prisma.user.findUnique({
    where: { phoneNumber },
    select: { id: true },
  });

  return {
    userId: user?.id ?? null,
    phoneNumber,
  };
}

export async function getSuperAppTicketRequester(
  superAppToken?: string | null,
) {
  const session = await getSuperAppSessionFromToken(superAppToken);
  if (!session) {
    return null;
  }

  return {
    id: session.userId ?? `guest_${session.phoneNumber}`,
    role: { name: "Guest" as const },
    phoneNumber: session.phoneNumber,
  };
}

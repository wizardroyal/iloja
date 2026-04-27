import { Global, Module } from '@nestjs/common';
import { ESCROW_CUSTODIAN_PROVIDER } from './escrow/escrow-custodian.provider';
import { NullEscrowCustodianProvider } from './escrow/null-escrow-custodian.provider';
import { GEOCODING_PROVIDER } from './geocoding/geocoding.provider';
import { NullGeocodingProvider } from './geocoding/null-geocoding.provider';
import { KYC_PROVIDER } from './kyc/kyc.provider';
import { NullKycProvider } from './kyc/null-kyc.provider';
import { NullOtpProvider } from './otp/null-otp.provider';
import { OTP_PROVIDER } from './otp/otp.provider';
import { NullPaymentsProvider } from './payments/null-payments.provider';
import { PAYMENTS_PROVIDER } from './payments/payments.provider';
import { NullStorageProvider } from './storage/null-storage.provider';
import { STORAGE_PROVIDER } from './storage/storage.provider';

/**
 * Wires concrete provider implementations behind their abstract tokens. Swap
 * the `useClass` here when real Dojah / Paystack / Anchor / Mapbox / R2 /
 * Termii implementations land.
 */
@Global()
@Module({
  providers: [
    { provide: KYC_PROVIDER, useClass: NullKycProvider },
    { provide: STORAGE_PROVIDER, useClass: NullStorageProvider },
    { provide: GEOCODING_PROVIDER, useClass: NullGeocodingProvider },
    { provide: OTP_PROVIDER, useClass: NullOtpProvider },
    { provide: PAYMENTS_PROVIDER, useClass: NullPaymentsProvider },
    { provide: ESCROW_CUSTODIAN_PROVIDER, useClass: NullEscrowCustodianProvider },
  ],
  exports: [
    KYC_PROVIDER,
    STORAGE_PROVIDER,
    GEOCODING_PROVIDER,
    OTP_PROVIDER,
    PAYMENTS_PROVIDER,
    ESCROW_CUSTODIAN_PROVIDER,
  ],
})
export class ProvidersModule {}

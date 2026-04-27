import { Global, Module } from '@nestjs/common';
import { GEOCODING_PROVIDER } from './geocoding/geocoding.provider';
import { NullGeocodingProvider } from './geocoding/null-geocoding.provider';
import { KYC_PROVIDER } from './kyc/kyc.provider';
import { NullKycProvider } from './kyc/null-kyc.provider';
import { NullOtpProvider } from './otp/null-otp.provider';
import { OTP_PROVIDER } from './otp/otp.provider';
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
  ],
  exports: [KYC_PROVIDER, STORAGE_PROVIDER, GEOCODING_PROVIDER, OTP_PROVIDER],
})
export class ProvidersModule {}

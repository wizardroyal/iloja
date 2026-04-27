import { Global, Module } from '@nestjs/common';
import { KYC_PROVIDER } from './kyc/kyc.provider';
import { NullKycProvider } from './kyc/null-kyc.provider';

/**
 * Wires concrete provider implementations behind their abstract tokens. Swap
 * the `useClass` here when real Dojah / Paystack / Anchor implementations land.
 */
@Global()
@Module({
  providers: [{ provide: KYC_PROVIDER, useClass: NullKycProvider }],
  exports: [KYC_PROVIDER],
})
export class ProvidersModule {}

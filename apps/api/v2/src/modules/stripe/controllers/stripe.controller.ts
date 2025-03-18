import { API_VERSIONS_VALUES } from "@/lib/api-versions";
import { GetUser } from "@/modules/auth/decorators/get-user/get-user.decorator";
import { ApiAuthGuard } from "@/modules/auth/guards/api-auth/api-auth.guard";
import {
  OAuthCallbackState,
  OrganizationsStripeService,
} from "@/modules/organizations/stripe/services/organizations-stripe.service";
import {
  StripConnectOutputDto,
  StripConnectOutputResponseDto,
  StripCredentialsCheckOutputResponseDto,
  StripCredentialsSaveOutputResponseDto,
} from "@/modules/stripe/outputs/stripe.output";
import { StripeService } from "@/modules/stripe/stripe.service";
import { getOnErrorReturnToValueFromQueryState } from "@/modules/stripe/utils/getReturnToValueFromQueryState";
import { TokensRepository } from "@/modules/tokens/tokens.repository";
import { UserWithProfile } from "@/modules/users/users.repository";
import {
  Controller,
  Query,
  UseGuards,
  Get,
  HttpCode,
  HttpStatus,
  Redirect,
  Req,
  BadRequestException,
  Headers,
  Param,
} from "@nestjs/common";
import { ApiTags as DocsTags, ApiOperation } from "@nestjs/swagger";
import { plainToClass } from "class-transformer";
import { Request } from "express";
import { stringify } from "querystring";

import { SUCCESS_STATUS } from "@calcom/platform-constants";

@Controller({
  path: "/v2/stripe",
  version: API_VERSIONS_VALUES,
})
@DocsTags("Stripe")
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly organizationsStripeService: OrganizationsStripeService,
    private readonly tokensRepository: TokensRepository
  ) {}

  @Get("/connect")
  @UseGuards(ApiAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get stripe connect URL" })
  async redirect(
    @Req() req: Request,
    @Headers("Authorization") authorization: string,
    @GetUser() user: UserWithProfile,
    @Query("returnTo") returnTo?: string | null,
    @Query("onErrorReturnTo") onErrorReturnTo?: string | null
  ): Promise<StripConnectOutputResponseDto> {
    const origin = req.headers.origin;
    const accessToken = authorization.replace("Bearer ", "");

    const state: OAuthCallbackState = {
      onErrorReturnTo: !!onErrorReturnTo ? onErrorReturnTo : origin,
      fromApp: false,
      returnTo: !!returnTo ? returnTo : origin,
      accessToken,
    };

    const stripeRedirectUrl = await this.stripeService.getStripeRedirectUrl(state, user.email, user.name);

    return {
      status: SUCCESS_STATUS,
      data: plainToClass(StripConnectOutputDto, { authUrl: stripeRedirectUrl }, { strategy: "excludeAll" }),
    };
  }

  @Get("/save")
  @UseGuards()
  @Redirect(undefined, 301)
  @ApiOperation({ summary: "Save stripe credentials" })
  async save(
    @Query("state") state: string,
    @Query("code") code: string,
    @Query("error") error: string | undefined,
    @Query("error_description") error_description: string | undefined
  ): Promise<StripCredentialsSaveOutputResponseDto> {
    if (!state) {
      throw new BadRequestException("Missing `state` query param");
    }

    const decodedCallbackState: OAuthCallbackState = JSON.parse(state);
    try {
      const userId = await this.tokensRepository.getAccessTokenOwnerId(decodedCallbackState.accessToken);

      // user cancels flow
      if (error === "access_denied") {
        return { url: getOnErrorReturnToValueFromQueryState(state) };
      }

      if (error) {
        throw new BadRequestException(stringify({ error, error_description }));
      }

      if (!userId) {
        throw new BadRequestException("Invalid Access token.");
      }

      if (decodedCallbackState.orgId) {
        // If we have an orgId, this is an organization-level operation
        return await this.organizationsStripeService.saveStripeAccount({
          state: decodedCallbackState,
          code,
          userId,
        });
      } else {
        // Otherwise, it's a regular user-level operation
        return await this.stripeService.saveStripeAccount(decodedCallbackState, code, userId, null);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      }
      return {
        url: decodedCallbackState.onErrorReturnTo ?? "",
      };
    }
  }

  @Get("/check")
  @UseGuards(ApiAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Check stripe connection" })
  async check(@GetUser() user: UserWithProfile): Promise<StripCredentialsCheckOutputResponseDto> {
    return await this.stripeService.checkIfIndividualStripeAccountConnected(user.id);
  }
}

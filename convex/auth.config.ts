const domain = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
if (!domain) {
  throw new Error(
    "Missing auth domain: set BETTER_AUTH_URL or NEXT_PUBLIC_APP_URL",
  );
}

export default {
  providers: [
    {
      domain,
      applicationID: "better-auth",
    },
  ],
};

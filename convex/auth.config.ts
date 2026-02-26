export default {
  providers: [
    {
      domain: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
      applicationID: "better-auth",
    },
  ],
};

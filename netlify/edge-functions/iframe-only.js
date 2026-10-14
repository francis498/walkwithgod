export default async (request, context) => {
//  if (request.headers.get("sec-fetch-dest") === "document") {
//    return new Response(
//      "<h2>Please open this app from inside the community.</h2>",
//      { status: 403, headers: { "content-type": "text/html" } }
//    );
//  }
  return context.next();
};

export const config = { path: "/*" };

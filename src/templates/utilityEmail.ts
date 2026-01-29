export const getUtilityEmailHtml = (content: string): string => {
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Incridea Email</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; color: #ffffff; background-color: #000000; background-image: url('https://9ec732lutu.ufs.sh/f/aVR2JOdkpmeKE41TH0y6y8QdYLPwHThxcUGZaSrEvjn2BqD4'); background-repeat: no-repeat; background-position: center; background-size: cover;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgba(0, 0, 0, 0.6); min-height: 70vh; aspect-ratio: 21/9;">
      <tr>
        <td align="center" valign="middle" style="padding: 40px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background: linear-gradient(135deg, rgba(0, 0, 0, 0.8), rgba(10, 10, 10, 0.95)); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); max-width: 100%; color: #ffffff;">
            <tr>
              <td style="padding: 0;">
                <div style="background: linear-gradient(135deg, #000000, #1a1a1a); padding: 40px 32px; text-align: center;">
                  <img src="https://idtisg3yhk.ufs.sh/f/EfXdVhpoNtwlAtbnqEeXiCHRSzQv8DJPLwYBfc0lb2jqhnAk" alt="Incridea" height="72" style="display: inline-block; height: 72px; width: auto; border: 0;" />
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <div style="font-size: 16px; line-height: 1.6; color: #e2e8f0; text-align: left;">
                  ${content}
                </div>
              </td>
            </tr>
            <tr>
              <td style="background-color: linear-gradient(135deg, #000000, #1a1a1a); padding: 20px 32px; text-align: center; font-size: 12px; color: #e2e8f0;">
                <p style="margin: 0; ">Team Incridea</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
};

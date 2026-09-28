namespace Samhallsinformation.Application.Auth;

// Rollnamnen som [Authorize(Roles = ...)] på admin-controllers matchar mot
// JWT:ns role-claim (User.Role). Konstanter så att en stavning aldrig kan
// glida isär mellan controllers (D1, V3-10).
//
// OBS: flera [Authorize]-attribut på samma action ANDas. En klass med
// AdminEllerSupport + en metod med Admin ger alltså Admin-only för metoden,
// men en metod kan aldrig VIDGA klassens roller. Därför gäller:
//   - En klass får bara ha AdminEllerSupport om varje skriv-/destruktiv action
//     i den uttryckligen är märkt med Admin. SupportRollBehorighetTests låser
//     hela Support-ytan mot en godkänd lista, så en ny action som råkar bli
//     öppen för Support fäller testet.
public static class AdminRoller
{
    public const string Admin = "Admin";
    public const string Support = "Support";

    // Roles-strängen är en ELLER-lista: Admin ELLER Support räcker.
    public const string AdminEllerSupport = Admin + "," + Support;
}

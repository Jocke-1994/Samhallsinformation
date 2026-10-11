using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Samhallsinformation.Migrations
{
    /// <inheritdoc />
    public partial class AddUppdateringPushBanderoll : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PushMeddelande",
                table: "Uppdateringar",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PushVersion",
                table: "Uppdateringar",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "SkickaPush",
                table: "Uppdateringar",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "VisaBanderoll",
                table: "Uppdateringar",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PushMeddelande",
                table: "Uppdateringar");

            migrationBuilder.DropColumn(
                name: "PushVersion",
                table: "Uppdateringar");

            migrationBuilder.DropColumn(
                name: "SkickaPush",
                table: "Uppdateringar");

            migrationBuilder.DropColumn(
                name: "VisaBanderoll",
                table: "Uppdateringar");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Samhallsinformation.Migrations
{
    /// <inheritdoc />
    public partial class AddAktivitetsloggFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AktörTyp",
                table: "AdminActivityLogs",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "Arkiverad",
                table: "AdminActivityLogs",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Enhet",
                table: "AdminActivityLogs",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GammaltVärde",
                table: "AdminActivityLogs",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Ip",
                table: "AdminActivityLogs",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NyttVärde",
                table: "AdminActivityLogs",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Test",
                table: "AdminActivityLogs",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AktörTyp",
                table: "AdminActivityLogs");

            migrationBuilder.DropColumn(
                name: "Arkiverad",
                table: "AdminActivityLogs");

            migrationBuilder.DropColumn(
                name: "Enhet",
                table: "AdminActivityLogs");

            migrationBuilder.DropColumn(
                name: "GammaltVärde",
                table: "AdminActivityLogs");

            migrationBuilder.DropColumn(
                name: "Ip",
                table: "AdminActivityLogs");

            migrationBuilder.DropColumn(
                name: "NyttVärde",
                table: "AdminActivityLogs");

            migrationBuilder.DropColumn(
                name: "Test",
                table: "AdminActivityLogs");
        }
    }
}

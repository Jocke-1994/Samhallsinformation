using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Samhallsinformation.Migrations
{
    /// <inheritdoc />
    public partial class AddPushSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserDevices_Token",
                table: "UserDevices");

            migrationBuilder.DropColumn(
                name: "Token",
                table: "UserDevices");

            migrationBuilder.AddColumn<bool>(
                name: "PushEnabled",
                table: "Users",
                type: "INTEGER",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "Auth",
                table: "UserDevices",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Endpoint",
                table: "UserDevices",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "P256dh",
                table: "UserDevices",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_UserDevices_Endpoint",
                table: "UserDevices",
                column: "Endpoint",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserDevices_Endpoint",
                table: "UserDevices");

            migrationBuilder.DropColumn(
                name: "PushEnabled",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Auth",
                table: "UserDevices");

            migrationBuilder.DropColumn(
                name: "Endpoint",
                table: "UserDevices");

            migrationBuilder.DropColumn(
                name: "P256dh",
                table: "UserDevices");

            migrationBuilder.AddColumn<string>(
                name: "Token",
                table: "UserDevices",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_UserDevices_Token",
                table: "UserDevices",
                column: "Token",
                unique: true);
        }
    }
}

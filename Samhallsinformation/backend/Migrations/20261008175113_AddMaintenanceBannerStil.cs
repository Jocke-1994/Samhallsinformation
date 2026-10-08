using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Samhallsinformation.Migrations
{
    /// <inheritdoc />
    public partial class AddMaintenanceBannerStil : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LankUrl",
                table: "MaintenanceBanners",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Rubrik",
                table: "MaintenanceBanners",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Stil",
                table: "MaintenanceBanners",
                type: "TEXT",
                nullable: false,
                defaultValue: "Drift");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LankUrl",
                table: "MaintenanceBanners");

            migrationBuilder.DropColumn(
                name: "Rubrik",
                table: "MaintenanceBanners");

            migrationBuilder.DropColumn(
                name: "Stil",
                table: "MaintenanceBanners");
        }
    }
}

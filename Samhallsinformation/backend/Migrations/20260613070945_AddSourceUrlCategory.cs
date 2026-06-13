using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Samhallsinformation.Migrations
{
    /// <inheritdoc />
    public partial class AddSourceUrlCategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "Sources",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Url",
                table: "Sources",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Category",
                table: "Sources");

            migrationBuilder.DropColumn(
                name: "Url",
                table: "Sources");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Samhallsinformation.Migrations
{
    /// <inheritdoc />
    public partial class AddIsTestOnlyToSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsTestOnly",
                table: "Sources",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsTestOnly",
                table: "Sources");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Samhallsinformation.Migrations
{
    /// <inheritdoc />
    public partial class AddFeatureFlagOverrides : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FeatureFlagOverrides",
                columns: table => new
                {
                    Key = table.Column<string>(type: "TEXT", nullable: false),
                    Value = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeatureFlagOverrides", x => x.Key);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FeatureFlagOverrides");
        }
    }
}

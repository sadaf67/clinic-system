using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClinicSystem.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class FixPatientRelationships : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Consultations_Patients_PatientId1",
                table: "Consultations");

            migrationBuilder.DropForeignKey(
                name: "FK_Prescriptions_Patients_PatientId1",
                table: "Prescriptions");

            migrationBuilder.DropForeignKey(
                name: "FK_VitalSigns_Patients_PatientId",
                table: "VitalSigns");

            migrationBuilder.DropIndex(
                name: "IX_Prescriptions_PatientId1",
                table: "Prescriptions");

            migrationBuilder.DropIndex(
                name: "IX_Consultations_PatientId1",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "PatientId1",
                table: "Prescriptions");

            migrationBuilder.DropColumn(
                name: "PatientId1",
                table: "Consultations");

            migrationBuilder.AddForeignKey(
                name: "FK_VitalSigns_Patients_PatientId",
                table: "VitalSigns",
                column: "PatientId",
                principalTable: "Patients",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_VitalSigns_Patients_PatientId",
                table: "VitalSigns");

            migrationBuilder.AddColumn<Guid>(
                name: "PatientId1",
                table: "Prescriptions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PatientId1",
                table: "Consultations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Prescriptions_PatientId1",
                table: "Prescriptions",
                column: "PatientId1");

            migrationBuilder.CreateIndex(
                name: "IX_Consultations_PatientId1",
                table: "Consultations",
                column: "PatientId1");

            migrationBuilder.AddForeignKey(
                name: "FK_Consultations_Patients_PatientId1",
                table: "Consultations",
                column: "PatientId1",
                principalTable: "Patients",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Prescriptions_Patients_PatientId1",
                table: "Prescriptions",
                column: "PatientId1",
                principalTable: "Patients",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_VitalSigns_Patients_PatientId",
                table: "VitalSigns",
                column: "PatientId",
                principalTable: "Patients",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}

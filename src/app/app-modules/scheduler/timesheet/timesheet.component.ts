/*
* AMRIT – Accessible Medical Records via Integrated Technology 
* Integrated EHR (Electronic Health Records) Solution 
*
* Copyright (C) "Piramal Swasthya Management and Research Institute" 
*
* This file is part of AMRIT.
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with this program.  If not, see https://www.gnu.org/licenses/.
*/
import { Component, OnInit, ViewChild, ChangeDetectorRef, Input,OnChanges } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FullCalendarComponent } from '@fullcalendar/angular';
import { Moment } from 'moment';

import { SchedulerService } from '../shared/services/scheduler.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { SetLanguageComponent } from '../../core/components/set-language.component';
import { HttpServiceService } from '../../core/services/http-service.service';
import { Options } from 'html2canvas';

@Component({
  selector: 'app-timesheet',
  templateUrl: './timesheet.component.html',
  styleUrls: ['./timesheet.component.css']
})
export class TimesheetComponent implements OnInit, OnChanges {

  @Input('getChangedTab')
  getChangedTab!: boolean;

  @ViewChild(FullCalendarComponent) ucCalendar!: FullCalendarComponent;
  calendarOptions: Options | null =null;

  availabiltyForm!: FormGroup;
  timeList: any[] = [];
  dayList: any[] = [];
  excludedDay = [];

  minSelectableDate: any;
  maxSelectableDate: any;

  designation: any;
  specializationMaster: any;
  specialistList: any;
  selectedSpecialization: any;
  selectedSpecialist: any;

  languageComponent!: SetLanguageComponent;
  currentLanguageSet: any;
  
  constructor(
    private fb: FormBuilder,
    private cdRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    public httpServiceService: HttpServiceService,
    private confirmationService: ConfirmationService,
    private schedulerService: SchedulerService) { }

  ngOnInit() {
    this.initializeCalender();
    this.fetchLanguageResponse();
  }

  ngOnChanges() {
    if (this.getChangedTab) {
      this.initializeCalender();
      this.calendarOptions  = null;
    }
  }

  initializeCalender() {
    this.createAvailabiltyForm();
    this.initDayList();
    this.initTimeList();
    this.getSpecialisationMaster();
    this.getUserDesignation();

    this.minSelectableDate = new Date();
    let temp = new Date();
    temp.setMonth(temp.getMonth() + 2);
    this.maxSelectableDate = temp;
  }


  getUserDesignation() {
    let userInfo;
    this.route.params.subscribe(param => {
      this.designation = param['designation'];
      if (this.designation == "TC Specialist") {
        userInfo = { userID: localStorage.getItem('tm-userID') };
      } else {
        userInfo = { userID: localStorage.getItem('supervisor-specialistID') };
      }
      let date = new Date();
      this.selectedSpecialist = userInfo;
      this.schedulerService.getAllEvents(userInfo, date.getFullYear(), date.getMonth() + 1)
        .subscribe((res: any) => {
          let eventSourceList = res.data;
          let eventSources = this.mapResponseToEventSources(eventSourceList);
          this.initCalender(eventSources);
        });
    })
  }

  submitAvailabilityForm(availabiltyForm: any) {
    let availabilityFormValue: any = JSON.parse(JSON.stringify(this.availabiltyForm.value));

    let fromDate = new Date(availabilityFormValue.configuredFromDate);
    fromDate.setHours(5, 30, 0, 0);
    availabilityFormValue.configuredFromDate = fromDate;

    let fromTime = new Date(availabilityFormValue.configuredFromTime);
    let temp1 = new Date(availabilityFormValue.configuredFromDate);
    temp1.setHours(fromTime.getHours() + 5, fromTime.getMinutes() + 30);
    availabilityFormValue.configuredFromTime = temp1.toJSON();

    let toDate = new Date(availabilityFormValue.configuredToDate);
    toDate.setHours(5, 30, 0, 0);
    availabilityFormValue.configuredToDate = toDate;

    availabilityFormValue.ExcludeDays = this.getExcludedDays(this.dayList);

    availabilityFormValue.createdBy = localStorage.getItem('tm-userName');
    availabilityFormValue.userID = this.selectedSpecialist.userID;

    if (availabilityFormValue.isAvailability === 'true') {
      let toTime = new Date(availabilityFormValue.configuredToTime);
      let temp2 = new Date(availabilityFormValue.configuredToDate);
      temp2.setHours(toTime.getHours() + 5, toTime.getMinutes() + 30);
      availabilityFormValue.configuredToTime = temp2.toJSON();
      this.markAvailability(availabiltyForm, availabilityFormValue);
    } else {
      let toTime = new Date(availabilityFormValue.configuredToTime);
      let temp3 = new Date(availabilityFormValue.configuredFromDate);
      temp3.setHours(toTime.getHours() + 5, toTime.getMinutes() + 30);
      availabilityFormValue.configuredToTime = temp3.toJSON();

      availabilityFormValue.ExcludeDays = undefined;
      availabilityFormValue.toDate = undefined;
      this.markNonAvailability(availabiltyForm, availabilityFormValue);
    }
  }
  markAvailability(availabiltyForm: FormGroup, availabilityFormValue: any) 
  { this.schedulerService.markAvailability(availabilityFormValue) .subscribe({ next: (res: any) => 
    { if (res.statusCode == 200 && res.data)
       { this.confirmationService.alert(this.currentLanguageSet.markedSuccessfully, 'success'); 
       availabiltyForm.reset();
        availabiltyForm.markAsPristine();
         this.calendarOptions = null; this.initializeCalender(); }
         
         else 
         { this.confirmationService.alert(res.errorMessage, 'warn'); } 
        },
          error: (error: any) => { 
            if (error && error.error) { 
              this.confirmationService.alert(error.error, 'warn'); }
           }, 
          });}

  markNonAvailability(availabiltyForm: any, nonAvailabilityFormValue: any) {
    this.schedulerService.markNonAvailability(nonAvailabilityFormValue)
      .subscribe({next:(res: any) => {
        if (res.statusCode == 200 && res.data) {
          this.confirmationService.alert(this.currentLanguageSet.markedSuccessfully, 'success');
          availabiltyForm.reset();
          availabiltyForm.markAsPristine();
          this.initDayList();
          this.ucCalendar.getApi().removeAllEventSources();
          this.getMonthEvents(new Date());
        } else {
          this.confirmationService.alert(res.errorMessage, 'warn');
        }
      }, 
      error: (error: any) => {
        this.confirmationService.alert(error, 'warn');
  }})
  }

  clickButton(model: any) {
    let temp = model.data as Moment;
    this.ucCalendar.getApi().removeAllEventSources();
    this.getMonthEvents(temp.toDate());
  }

  initCalender(eventSources?: any) {
    this.calendarOptions = {
      themeSystem: "bootstrap3",
      editable: false,
      eventLimit: true,
      header: {
        left: 'prev,next',
        center: 'title',
        right: 'month,listMonth'
      },
      displayEventEnd: true,
      displayEventTime: true,
      timeFormat: 'HH:mm',
      eventSources: eventSources || []
    } as any;
  }

  getMonthEvents(date?: Date) {
    if (!date) date = new Date();

    let userInfo = { userID: this.selectedSpecialist.userID };

    this.schedulerService.getAllEvents(userInfo, date.getFullYear(), date.getMonth() + 1)
      .subscribe((res: any) => {
        if (res.statusCode == 200 && res.data) {
          let eventSourceList = res.data;
          let eventSources = this.mapResponseToEventSources(eventSourceList);
          eventSources.forEach(eventSource => {
            this.ucCalendar.getApi().addEventSource(eventSource);
          });
        } else {
          this.confirmationService.alert(res.errorMessage, 'warn');
        }
      });
  }

  getSpecialisationMaster() {
    this.schedulerService.getSpecializationMaster()
      .subscribe((res: any) => {
        if (res.statusCode == 200 && res.data) {
          this.specializationMaster = res.data;
        }
      });
  }

  getSpecialist() {    
    this.ucCalendar.getApi().removeAllEventSources();
    this.selectedSpecialist = undefined;
    this.availabiltyForm.reset();

    let providerServiceMapID = localStorage.getItem("tm-providerServiceMapID");
    let userID = localStorage.getItem("tm-userID");
    let specializationID = this.selectedSpecialization.specializationID;
    this.schedulerService.getSpecialist({ specializationID, providerServiceMapID, userID })
      .subscribe({next: (res: any) => {
        if (res.statusCode == 200 && res.data) {
          this.specialistList = res.data;
        } else {
          this.specialistList = [];
        }
      },
      error: (error: any) => {
        this.specialistList = [];
  }})
  }

  mapResponseToEventSources(eventSourceList: any) {
    let temp: any[] = [];
    eventSourceList.forEach((eventSource: any) => {
      const dateObj = new Date(eventSource.configuredDate);
      const yearMonthDay = this.getDateString(dateObj);
      eventSource.slots.forEach((slot: any) => {
        let events = [];
        let color = slot.status == "Available" ? 'green' : 'red';
        events.push({
          start: yearMonthDay + 'T' + slot.fromTime + 'Z',
          end: yearMonthDay + 'T' + slot.toTime + 'Z'
        });
        temp.push({ events, color });
      });
    });
    return temp;
  }

  createAvailabiltyForm() {
    this.availabiltyForm = this.fb.group({
      "configuredFromDate": null,
      "configuredToDate": null,
      "configuredFromTime": null,
      "configuredToTime": null,
      "isAvailability": null,
    })
  }

  initDayList() {
    this.dayList = [ {
      name: "S",
      isWeedend: true,
      isSelected: false
    },
      {
        name: "M",
        isWeedend: false,
        isSelected: false
      }, {
        name: "T",
        isWeedend: false,
        isSelected: false
      }, {
        name: "W",
        isWeedend: false,
        isSelected: false
      }, {
        name: "T",
        isWeedend: false,
        isSelected: false
      }, {
        name: "F",
        isWeedend: false,
        isSelected: false
      }, {
        name: "S",
        isWeedend: true,
        isSelected: false
      }
    ];
  }

  initTimeList() {
    for (let i = 0; i < 24; i++) {
      for (let j = 0; j < 60; j = j + 5) {
        let hours = i.toString().length == 1 ? 0 + i.toString() : i.toString();
        let minutes = j.toString().length == 1 ? 0 + j.toString() : j.toString();
        this.timeList.push(hours + ":" + minutes + ":00");
      }
    }
  }

  getExcludedDays(dateArray: any) {
    let excludedDays: any[] = [];
    dateArray.forEach((element: any, index: any) => {
      if (element.isSelected) excludedDays.push(index);
    });
    return excludedDays;
  }

  getDateString(dateObj: any) {
    let dd: any = dateObj.getDate();
    let mm: any = dateObj.getMonth() + 1;
    let yyyy = dateObj.getFullYear();

    if (dd < 10) {
      dd = '0' + dd
    }

    if (mm < 10) {
      mm = '0' + mm
    }

    return yyyy + '-' + mm + '-' + dd;
  }

  startOfDate(dateString: any) {
    let start = new Date(dateString);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  get isAvailability() {
    return this.availabiltyForm.controls['isAvailability'].value;
  }

  get configuredFromDate() {
    let fd = this.availabiltyForm.controls['configuredFromDate'].value;
    if (fd)
      fd.setHours(0, 0, 0, 0);
    return fd;
  }

  get configuredToDate() {
    let td = this.availabiltyForm.controls['configuredToDate'].value;
    if (td)
      td.setHours(0, 0, 0, 0);
    return td;
  }

  get configuredFromTime() {
    return this.availabiltyForm.controls['configuredFromTime'].value;
  }

  configuredToDateBoolean: boolean = true;

  resetFormValue() {
    this.configuredToDateBoolean = true;
    this.availabiltyForm.patchValue({
      configuredFromDate: null, configuredToDate: null, configuredFromTime: null, configuredToTime: null
    })
    if (this.isAvailability === 'true') {
      this.availabiltyForm.get('configuredToDate')!.clearValidators();
    } else {
      this.configuredToDateBoolean = false;
    }
  }

  //AN40085822 27/9/2021 Integrating Multilingual Functionality --Start--
  ngDoCheck(){
    this.fetchLanguageResponse();
  }

  fetchLanguageResponse() {
    this.languageComponent = new SetLanguageComponent(this.httpServiceService);
    this.languageComponent.setLanguage();
    this.currentLanguageSet = this.languageComponent.currentLanguageObject; 
  }
  //--End--
}

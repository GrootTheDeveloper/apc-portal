```mermaid
erDiagram

  "departments" {

    }
  

  "users" {

    }
  

  "posts" {

    }
  

  "events" {

    }
  

  "projects" {

    }
  

  "recruitment_rounds" {

    }
  

  "membership_applications" {

    }
  
    "users" }o--|o "departments" : "department"
    "posts" }o--|| "users" : "author"
    "posts" }o--|o "departments" : "department"
    "posts" }o--|o "users" : "publishedBy"
    "events" }o--|o "departments" : "department"
    "events" }o--|| "users" : "createdBy"
    "projects" }o--|o "departments" : "department"
    "projects" }o--|| "users" : "createdBy"
    "recruitment_rounds" }o--|| "users" : "createdBy"
    "membership_applications" }o--|| "recruitment_rounds" : "recruitmentRound"
    "membership_applications" }o--|o "departments" : "desiredDepartment"
    "membership_applications" }o--|o "users" : "reviewedBy"
    "membership_applications" |o--|o "users" : "convertedUser"
```

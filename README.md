## Dusting The Web ##

The aim of this code is to measure the prevalence of "bad things" on the web. This code was written by 
Jonathan Chang, David He, Josh Hawn, Stephanie Hui, Richard Zhao, Catherine Duncan as part of their 
CS161 project at UC Berkeley. They have kindly agreed to open source their code and results.

The whole code is designed to pass jslint. 

The architecture is to run content scripts before and after the page loads to MITM bad behavior and log it 
by sending it to background.html. The background page can either send it to a DB (code for which is separately
available at https://github.com/rzhao/dustingtheweb_db or to another logging extensio (https://github.com/devd/chrome-filelogger) 

Based on the logs, we generated stats for two runs:

* Day to day browsing of 6 students for roughly 3 weeks in April. These stats are under statistics/DTW_herko.pdf 

* Manual exploration of the top 120 alexa websites, these stats are under statistics/DTW_alexa.pdf

For obvious reasons, we are not opensourcing the data. 


The project is inspired by Singh et al.'s fantastic paper http://research.microsoft.com/en-us/people/alexmos/incoherency.pdf


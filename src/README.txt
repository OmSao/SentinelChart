Inside the playbuttonText click function.
Inside the buttonText.text() == "Play"

Using a for loop, for each of the unique date

We need to change 3 items.
1. Angular Axis
2. Angular Tick Labels.
3. Risk Bubbles and their Labels

So, basicaly inside "Play" clicked clean all above 3. We need to keep a note of items like

month which being shown, it's index in unique months list.

Plot all the riskBubbles where .data() will execute each bubble/label and .transition().duration(1000) check if there are options for easeout or other kind of animation


1 - 464 = 1/3/2019 = 463 /march
465 - 927 = 1/4/2019 = 462 /april
928 - 1388 = 1/5/2019 = 460 /may
1389 - 1849 = 1/6/2019 = 460 /june
1850 - 2310 = 1/7/2019 = 460 /july
2311 - 2771 = 1/8/2019 = 460 /august

__________________________________________
1. During Drill down, all labels are at 0,0. Why ?
2. Date issue in PBI
2. Selection sensitive.: https://github.com/microsoft/PowerBI-visuals/blob/master/Visual/Selection.md
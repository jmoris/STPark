import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgIconsModule } from '@ng-icons/core';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    imports: [RouterOutlet, NgIconsModule],
})
export class AppComponent {
    /**
     * Constructor
     */
    constructor() {}
}

import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AvisosComponent } from './shared/components/avisos.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AvisosComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('pidefacil-frontend');
}
